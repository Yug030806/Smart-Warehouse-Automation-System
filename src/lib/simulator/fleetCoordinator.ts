/**
 * Fleet Coordinator — Global Inter-Vehicle Coordination System
 * 
 * ARCHITECTURE PRINCIPLE:
 * The fleet coordinator must NOT directly control every AMR's safety decision.
 * Each AMR's Edge-AI engine remains responsible for local safety decisions
 * such as STOP, SLOW_DOWN and EMERGENCY_STOP.
 * 
 * The fleet coordinator is responsible for:
 *   - Inter-vehicle coordination
 *   - Information sharing (obstacle broadcasting)
 *   - Conflict resolution (two vehicles approaching same cell)
 *   - Right-of-way negotiation (URGENT task → priority)
 *   - Global task coordination
 * 
 * Flow:
 *   AMR-01 Edge AI detects obstacle → STOP (local decision)
 *   → Fleet Coordinator receives report
 *   → Broadcast obstacle to nearby AMRs
 *   → Nearby AMRs' Edge-AI engines process the info
 *   → A* recalculates routes where needed
 */

import { FleetMessage, Vehicle, Task, EdgeAIDecision } from '../database.types';
import { ObstacleCell } from './edgeAIEngine';
import mockDb from '../supabase/mockDb';

export interface FleetConflict {
  id: string;
  vehicle1_id: string;
  vehicle2_id: string;
  contested_cell: { x: number; y: number; floor_id: string };
  resolution: 'VEHICLE1_PRIORITY' | 'VEHICLE2_PRIORITY' | 'BOTH_REROUTE' | 'PENDING';
  reason: string;
  timestamp: number;
}

export interface FleetMetrics {
  totalObstaclesReported: number;
  totalConflictsResolved: number;
  totalBroadcasts: number;
  totalYields: number;
  activeVehicles: number;
  vehiclesWithSensors: number;
}

export type FleetEventCallback = (event: {
  type: 'OBSTACLE_BROADCAST' | 'CONFLICT_RESOLVED' | 'YIELD_ISSUED' | 'LANE_GRANTED' | 'POSITION_UPDATE';
  message: string;
  data?: any;
}) => void;

class FleetCoordinatorSingleton {
  private globalObstacles: ObstacleCell[] = [];
  private activeConflicts: FleetConflict[] = [];
  private resolvedConflicts: FleetConflict[] = [];
  private metrics: FleetMetrics = {
    totalObstaclesReported: 0,
    totalConflictsResolved: 0,
    totalBroadcasts: 0,
    totalYields: 0,
    activeVehicles: 0,
    vehiclesWithSensors: 0
  };
  private eventListeners: Set<FleetEventCallback> = new Set();

  // Subscribe to fleet events (for UI console log)
  onEvent(callback: FleetEventCallback) {
    this.eventListeners.add(callback);
    return () => { this.eventListeners.delete(callback); };
  }

  private emitEvent(event: Parameters<FleetEventCallback>[0]) {
    this.eventListeners.forEach(cb => cb(event));
  }

  /**
   * Called by an AMR's Edge-AI engine AFTER it makes a local STOP decision.
   * The fleet coordinator broadcasts the obstacle to all other vehicles.
   */
  reportObstacle(obstacle: ObstacleCell, reportingVehicleId: string) {
    // Register the obstacle globally
    this.globalObstacles.push(obstacle);
    this.metrics.totalObstaclesReported++;

    // Clean expired obstacles
    this.globalObstacles = this.globalObstacles.filter(
      o => Date.now() - o.timestamp < o.ttl
    );

    // Get all other active vehicles on the same floor
    const vehicles = mockDb.getVehicles().filter(
      v => v.id !== reportingVehicleId && 
           v.current_floor_id === obstacle.floor_id && 
           v.status !== 'OFFLINE'
    );
    const reporter = mockDb.getVehicles().find(v => v.id === reportingVehicleId);
    const reporterCode = reporter?.vehicle_code || reportingVehicleId;

    // Broadcast obstacle to all nearby vehicles
    vehicles.forEach(v => {
      const message: FleetMessage = {
        id: `fm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        from_vehicle_id: reportingVehicleId,
        to_vehicle_id: v.id,
        message_type: 'OBSTACLE_REPORT',
        payload: {
          obstacle_x: obstacle.x,
          obstacle_y: obstacle.y,
          floor_id: obstacle.floor_id,
          ttl: obstacle.ttl
        },
        created_at: new Date().toISOString()
      };
      mockDb.addFleetMessage(message);
    });

    this.metrics.totalBroadcasts++;

    this.emitEvent({
      type: 'OBSTACLE_BROADCAST',
      message: `${reporterCode} detected obstacle at [${obstacle.x},${obstacle.y}] → broadcast to ${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}`,
      data: { obstacle, notifiedCount: vehicles.length }
    });
  }

  /**
   * Check if two vehicles are about to collide / contest the same grid cell.
   * Returns a conflict resolution if applicable.
   * 
   * Right-of-way rules:
   *   1. URGENT task → always gets priority
   *   2. Higher priority task → gets priority
   *   3. Vehicle already closer to contested cell → gets priority
   *   4. Tie-breaker: lower vehicle ID
   */
  checkAndResolveConflict(
    vehicle1Id: string, vehicle1NextX: number, vehicle1NextY: number,
    vehicle2Id: string, vehicle2NextX: number, vehicle2NextY: number,
    floorId: string
  ): FleetConflict | null {
    // Only conflict if both heading to the same cell
    if (vehicle1NextX !== vehicle2NextX || vehicle1NextY !== vehicle2NextY) {
      return null;
    }

    const v1 = mockDb.getVehicles().find(v => v.id === vehicle1Id);
    const v2 = mockDb.getVehicles().find(v => v.id === vehicle2Id);
    if (!v1 || !v2) return null;

    const tasks = mockDb.getTasks();
    const t1 = tasks.find(t => t.id === v1.current_task_id);
    const t2 = tasks.find(t => t.id === v2.current_task_id);

    let resolution: FleetConflict['resolution'];
    let reason: string;

    // Rule 1: URGENT task always wins
    if (t1?.priority === 'URGENT' && t2?.priority !== 'URGENT') {
      resolution = 'VEHICLE1_PRIORITY';
      reason = `${v1.vehicle_code} has URGENT task → RIGHT OF WAY. ${v2.vehicle_code} → YIELD`;
    } else if (t2?.priority === 'URGENT' && t1?.priority !== 'URGENT') {
      resolution = 'VEHICLE2_PRIORITY';
      reason = `${v2.vehicle_code} has URGENT task → RIGHT OF WAY. ${v1.vehicle_code} → YIELD`;
    }
    // Rule 2: Higher priority score
    else if ((t1?.priority_score || 0) > (t2?.priority_score || 0)) {
      resolution = 'VEHICLE1_PRIORITY';
      reason = `${v1.vehicle_code} has higher priority (${t1?.priority}) → RIGHT OF WAY`;
    } else if ((t2?.priority_score || 0) > (t1?.priority_score || 0)) {
      resolution = 'VEHICLE2_PRIORITY';
      reason = `${v2.vehicle_code} has higher priority (${t2?.priority}) → RIGHT OF WAY`;
    }
    // Rule 3: Closer vehicle gets priority
    else {
      const d1 = Math.abs(v1.x_position - vehicle1NextX) + Math.abs(v1.y_position - vehicle1NextY);
      const d2 = Math.abs(v2.x_position - vehicle2NextX) + Math.abs(v2.y_position - vehicle2NextY);
      if (d1 <= d2) {
        resolution = 'VEHICLE1_PRIORITY';
        reason = `${v1.vehicle_code} is closer to contested cell → RIGHT OF WAY`;
      } else {
        resolution = 'VEHICLE2_PRIORITY';
        reason = `${v2.vehicle_code} is closer to contested cell → RIGHT OF WAY`;
      }
    }

    const conflict: FleetConflict = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      vehicle1_id: vehicle1Id,
      vehicle2_id: vehicle2Id,
      contested_cell: { x: vehicle1NextX, y: vehicle1NextY, floor_id: floorId },
      resolution,
      reason,
      timestamp: Date.now()
    };

    this.activeConflicts.push(conflict);
    this.resolvedConflicts.push(conflict);
    this.metrics.totalConflictsResolved++;

    // Issue YIELD message to the yielding vehicle
    const yieldingVehicleId = resolution === 'VEHICLE1_PRIORITY' ? vehicle2Id : vehicle1Id;
    const priorityVehicleId = resolution === 'VEHICLE1_PRIORITY' ? vehicle1Id : vehicle2Id;

    const yieldMessage: FleetMessage = {
      id: `fm-yield-${Date.now()}`,
      from_vehicle_id: priorityVehicleId,
      to_vehicle_id: yieldingVehicleId,
      message_type: 'YIELD',
      payload: {
        contested_cell: conflict.contested_cell,
        reason: conflict.reason
      },
      created_at: new Date().toISOString()
    };
    mockDb.addFleetMessage(yieldMessage);
    this.metrics.totalYields++;

    this.emitEvent({
      type: 'CONFLICT_RESOLVED',
      message: reason,
      data: conflict
    });

    return conflict;
  }

  /**
   * Request lane access for a vehicle passing through a corridor.
   * Other vehicles on the same floor that are heading toward the same corridor will yield.
   */
  requestLane(vehicleId: string, corridorCells: { x: number; y: number }[], floorId: string): boolean {
    const requester = mockDb.getVehicles().find(v => v.id === vehicleId);
    if (!requester) return false;

    const message: FleetMessage = {
      id: `fm-lane-${Date.now()}`,
      from_vehicle_id: vehicleId,
      to_vehicle_id: null, // broadcast
      message_type: 'LANE_REQUEST',
      payload: { corridor: corridorCells, floor_id: floorId },
      created_at: new Date().toISOString()
    };
    mockDb.addFleetMessage(message);

    // Auto-grant for simplicity in simulation
    const grantMessage: FleetMessage = {
      id: `fm-grant-${Date.now()}`,
      from_vehicle_id: 'fleet-coordinator',
      to_vehicle_id: vehicleId,
      message_type: 'LANE_GRANT',
      payload: { corridor: corridorCells, floor_id: floorId },
      created_at: new Date().toISOString()
    };
    mockDb.addFleetMessage(grantMessage);

    this.emitEvent({
      type: 'LANE_GRANTED',
      message: `Lane granted to ${requester.vehicle_code} through corridor (${corridorCells.length} cells)`,
      data: { vehicleId, corridor: corridorCells }
    });

    return true;
  }

  /**
   * Get all currently active (non-expired) obstacles known to the fleet.
   */
  getGlobalObstacles(): ObstacleCell[] {
    this.globalObstacles = this.globalObstacles.filter(
      o => Date.now() - o.timestamp < o.ttl
    );
    return this.globalObstacles;
  }

  addGlobalObstacle(obstacle: ObstacleCell) {
    this.globalObstacles.push(obstacle);
  }

  removeGlobalObstacle(x: number, y: number, floor_id: string) {
    this.globalObstacles = this.globalObstacles.filter(o => !(o.x === x && o.y === y && o.floor_id === floor_id));
  }

  getMetrics(): FleetMetrics {
    const vehicles = mockDb.getVehicles();
    this.metrics.activeVehicles = vehicles.filter(v => v.status !== 'OFFLINE' && v.status !== 'MAINTENANCE').length;
    this.metrics.vehiclesWithSensors = vehicles.filter(v => v.sensor_suite_active).length;
    return { ...this.metrics };
  }

  getRecentConflicts(limit: number = 10): FleetConflict[] {
    return this.resolvedConflicts.slice(-limit);
  }

  reset() {
    this.globalObstacles = [];
    this.activeConflicts = [];
    this.resolvedConflicts = [];
    this.metrics = {
      totalObstaclesReported: 0,
      totalConflictsResolved: 0,
      totalBroadcasts: 0,
      totalYields: 0,
      activeVehicles: 0,
      vehiclesWithSensors: 0
    };
    mockDb.clearSensorReadings();
    mockDb.clearEdgeAIDecisions();
    mockDb.clearFleetMessages();
  }
}

// Singleton — one fleet coordinator for the entire warehouse
export const fleetCoordinator = new FleetCoordinatorSingleton();
