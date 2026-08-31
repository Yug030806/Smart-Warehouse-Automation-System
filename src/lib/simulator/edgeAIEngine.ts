/**
 * Edge-AI Engine — Per-Vehicle Autonomous Safety System
 * 
 * ARCHITECTURE PRINCIPLE:
 * Each AMR's Edge-AI engine is AUTONOMOUS for local safety decisions.
 * The fleet coordinator does NOT directly control any AMR's safety decisions.
 * 
 * Pipeline: Camera/Sensors → Edge AI → Local Decision → Report to Fleet
 * 
 * Decisions owned by this engine:
 *   - STOP: Obstacle detected, halt movement immediately
 *   - SLOW_DOWN: Human or uncertain detection, reduce speed
 *   - EMERGENCY_STOP: Critical proximity breach
 *   - CONTINUE: Path is clear
 * 
 * The fleet coordinator receives REPORTS from this engine and coordinates
 * between vehicles, but never overrides local safety.
 */

import { SensorReading, EdgeAIDecision, Vehicle } from '../database.types';
import mockDb from '../supabase/mockDb';

export interface EdgeAICallbacks {
  onSensorUpdate?: (reading: SensorReading) => void;
  onDecision?: (decision: EdgeAIDecision) => void;
  onObstacleDetected?: (x: number, y: number, floorId: string, vehicleId: string) => void;
}

export interface ObstacleCell {
  x: number;
  y: number;
  floor_id: string;
  detected_by: string;
  timestamp: number;
  ttl: number; // time to live in ms
}

export class EdgeAIEngine {
  private vehicleId: string;
  private isActive: boolean = false;
  private obstacleProbability: number = 0.12; // ~12% chance per step
  private callbacks: EdgeAICallbacks = {};
  private activeObstacles: ObstacleCell[] = [];
  private decisionCount: number = 0;
  private obstacleCount: number = 0;
  private lastDecision: EdgeAIDecision | null = null;
  private totalLatencyMs: number = 0;

  constructor(vehicleId: string, obstacleProbability?: number) {
    this.vehicleId = vehicleId;
    if (obstacleProbability !== undefined) {
      this.obstacleProbability = obstacleProbability;
    }
  }

  setCallbacks(callbacks: EdgeAICallbacks) {
    this.callbacks = callbacks;
  }

  activate() {
    this.isActive = true;
    // Update vehicle Edge-AI status in database
    const v = mockDb.getVehicles().find(x => x.id === this.vehicleId);
    if (v) {
      mockDb.saveVehicle({ ...v, edge_ai_status: 'ONLINE', sensor_suite_active: true });
    }
  }

  deactivate() {
    this.isActive = false;
    const v = mockDb.getVehicles().find(x => x.id === this.vehicleId);
    if (v) {
      mockDb.saveVehicle({ ...v, edge_ai_status: 'OFFLINE', sensor_suite_active: false });
    }
  }

  getStatus() {
    return {
      isActive: this.isActive,
      decisionCount: this.decisionCount,
      obstacleCount: this.obstacleCount,
      lastDecision: this.lastDecision,
      avgLatencyMs: this.decisionCount > 0 ? Math.round(this.totalLatencyMs / this.decisionCount) : 0,
      activeObstacles: this.activeObstacles.filter(o => Date.now() - o.timestamp < o.ttl)
    };
  }

  getActiveObstacles(): ObstacleCell[] {
    // Expire old obstacles
    this.activeObstacles = this.activeObstacles.filter(o => Date.now() - o.timestamp < o.ttl);
    return this.activeObstacles;
  }

  addManualObstacle(x: number, y: number, floorId: string) {
    const obstacle: ObstacleCell = {
      x, y, floor_id: floorId,
      detected_by: 'MANUAL',
      timestamp: Date.now(),
      ttl: 30000 // 30 seconds
    };
    this.activeObstacles.push(obstacle);
    return obstacle;
  }

  removeManualObstacle(x: number, y: number, floorId: string) {
    this.activeObstacles = this.activeObstacles.filter(o => !(o.x === x && o.y === y && o.floor_id === floorId));
  }

  /**
   * Core pipeline: Run sensor simulation for the NEXT grid cell the vehicle is about to move to.
   * Returns the Edge-AI decision. The vehicle controller MUST obey this decision.
   * 
   * Pipeline: Sensor Read → Threshold Check → Decision → Action
   */
  processStep(
    currentX: number, currentY: number,
    nextX: number, nextY: number,
    floorId: string,
    otherVehicles: Vehicle[]
  ): EdgeAIDecision {
    if (!this.isActive) {
      return this.makeDecision('CONTINUE', 'Edge-AI inactive', 'none');
    }

    // Step 1: Run all sensors
    const cameraReading = this.simulateCamera(nextX, nextY, floorId);
    const lidarReading = this.simulateLiDAR(nextX, nextY, floorId);
    const proximityReading = this.simulateProximity(currentX, currentY, nextX, nextY, floorId, otherVehicles);
    const imuReading = this.simulateIMU();

    // Notify callbacks for each sensor reading
    [cameraReading, lidarReading, proximityReading, imuReading].forEach(r => {
      mockDb.addSensorReading(r);
      this.callbacks.onSensorUpdate?.(r);
    });

    // Step 2: Decision pipeline — priority order (highest threat first)

    // EMERGENCY_STOP: Proximity sensor detects vehicle/obstacle at adjacent cell
    if (proximityReading.detection_type === 'VEHICLE' && proximityReading.confidence > 0.9) {
      return this.makeDecision(
        'EMERGENCY_STOP',
        `Proximity sensor: Vehicle detected at [${nextX},${nextY}] — EMERGENCY STOP`,
        proximityReading.id
      );
    }

    // STOP: Camera or LiDAR detects obstacle on the next cell
    if (cameraReading.detection_type === 'OBSTACLE' && cameraReading.confidence > 0.7) {
      this.registerObstacle(nextX, nextY, floorId);
      return this.makeDecision(
        'STOP',
        `Camera detected obstacle at [${nextX},${nextY}] (confidence: ${(cameraReading.confidence * 100).toFixed(0)}%)`,
        cameraReading.id
      );
    }

    if (lidarReading.detection_type === 'OBSTACLE' && lidarReading.reading_value < 30) {
      this.registerObstacle(nextX, nextY, floorId);
      return this.makeDecision(
        'STOP',
        `LiDAR: Obstacle proximity ${lidarReading.reading_value}cm at [${nextX},${nextY}]`,
        lidarReading.id
      );
    }

    // SLOW_DOWN: Human detected or low clearance
    if (cameraReading.detection_type === 'HUMAN') {
      return this.makeDecision(
        'SLOW_DOWN',
        `Camera detected human near [${nextX},${nextY}] — reducing speed`,
        cameraReading.id
      );
    }

    if (lidarReading.detection_type === 'LOW_CLEARANCE') {
      return this.makeDecision(
        'SLOW_DOWN',
        `LiDAR: Low clearance detected at [${nextX},${nextY}]`,
        lidarReading.id
      );
    }

    // Check if next cell has a known active obstacle
    const knownObstacle = this.activeObstacles.find(
      o => o.x === nextX && o.y === nextY && o.floor_id === floorId && (Date.now() - o.timestamp < o.ttl)
    );
    if (knownObstacle) {
      return this.makeDecision(
        'REROUTE',
        `Known obstacle at [${nextX},${nextY}] — requesting reroute`,
        'known-obstacle'
      );
    }

    // CONTINUE: All sensors clear
    return this.makeDecision('CONTINUE', 'All sensors clear', 'none');
  }

  // --- Private sensor simulations ---

  private simulateCamera(nextX: number, nextY: number, floorId: string): SensorReading {
    const roll = Math.random();
    let detection_type: SensorReading['detection_type'] = 'CLEAR';
    let confidence = 0.95;
    let reading_value = 100;

    if (roll < this.obstacleProbability * 0.6) {
      detection_type = 'OBSTACLE';
      confidence = 0.75 + Math.random() * 0.2;
      reading_value = Math.floor(Math.random() * 40 + 10);
    } else if (roll < this.obstacleProbability * 0.8) {
      detection_type = 'HUMAN';
      confidence = 0.6 + Math.random() * 0.3;
      reading_value = Math.floor(Math.random() * 50 + 20);
    }

    return {
      id: `sr-cam-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      vehicle_id: this.vehicleId,
      sensor_type: 'CAMERA',
      reading_value,
      detection_type,
      confidence: Math.round(confidence * 100) / 100,
      timestamp: new Date().toISOString()
    };
  }

  private simulateLiDAR(nextX: number, nextY: number, floorId: string): SensorReading {
    const roll = Math.random();
    let detection_type: SensorReading['detection_type'] = 'CLEAR';
    let confidence = 0.98;
    let reading_value = 100; // distance in cm (normalized)

    if (roll < this.obstacleProbability * 0.4) {
      detection_type = 'OBSTACLE';
      confidence = 0.85 + Math.random() * 0.15;
      reading_value = Math.floor(Math.random() * 25 + 5); // close proximity
    } else if (roll < this.obstacleProbability * 0.5) {
      detection_type = 'LOW_CLEARANCE';
      confidence = 0.7 + Math.random() * 0.2;
      reading_value = Math.floor(Math.random() * 40 + 30);
    }

    return {
      id: `sr-lid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      vehicle_id: this.vehicleId,
      sensor_type: 'LIDAR',
      reading_value,
      detection_type,
      confidence: Math.round(confidence * 100) / 100,
      timestamp: new Date().toISOString()
    };
  }

  private simulateProximity(
    currentX: number, currentY: number,
    nextX: number, nextY: number,
    floorId: string,
    otherVehicles: Vehicle[]
  ): SensorReading {
    // Check if another vehicle is at or adjacent to the next cell
    const nearbyVehicle = otherVehicles.find(v => 
      v.id !== this.vehicleId &&
      v.current_floor_id === floorId &&
      Math.abs(v.x_position - nextX) <= 1 &&
      Math.abs(v.y_position - nextY) <= 1 &&
      v.status !== 'OFFLINE'
    );

    const exactCollision = otherVehicles.find(v =>
      v.id !== this.vehicleId &&
      v.current_floor_id === floorId &&
      v.x_position === nextX &&
      v.y_position === nextY
    );

    let detection_type: SensorReading['detection_type'] = 'CLEAR';
    let confidence = 0.99;
    let reading_value = 100;

    if (exactCollision) {
      detection_type = 'VEHICLE';
      confidence = 0.99;
      reading_value = 0;
    } else if (nearbyVehicle) {
      detection_type = 'VEHICLE';
      confidence = 0.8;
      reading_value = 30;
    }

    return {
      id: `sr-prx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      vehicle_id: this.vehicleId,
      sensor_type: 'PROXIMITY',
      reading_value,
      detection_type,
      confidence: Math.round(confidence * 100) / 100,
      timestamp: new Date().toISOString()
    };
  }

  private simulateIMU(): SensorReading {
    // IMU mostly reports stable. Rare anomaly simulation
    const roll = Math.random();
    let detection_type: SensorReading['detection_type'] = 'CLEAR';
    let reading_value = 100;

    if (roll < 0.02) {
      detection_type = 'LOW_CLEARANCE'; // tilt anomaly
      reading_value = Math.floor(Math.random() * 30 + 10);
    }

    return {
      id: `sr-imu-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      vehicle_id: this.vehicleId,
      sensor_type: 'IMU',
      reading_value,
      detection_type,
      confidence: 0.95,
      timestamp: new Date().toISOString()
    };
  }

  // --- Decision making ---

  private makeDecision(
    type: EdgeAIDecision['decision_type'],
    reason: string,
    sensorId: string
  ): EdgeAIDecision {
    // Simulated edge processing latency: 5-50ms
    const latency = Math.floor(Math.random() * 45 + 5);

    const decision: EdgeAIDecision = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      vehicle_id: this.vehicleId,
      trigger_sensor_id: sensorId,
      decision_type: type,
      reason,
      latency_ms: latency,
      was_overridden: false,
      created_at: new Date().toISOString()
    };

    this.decisionCount++;
    this.totalLatencyMs += latency;
    this.lastDecision = decision;

    // Persist to database
    mockDb.addEdgeAIDecision(decision);

    // Update vehicle record
    const v = mockDb.getVehicles().find(x => x.id === this.vehicleId);
    if (v) {
      mockDb.saveVehicle({
        ...v,
        last_decision_id: decision.id,
        obstacle_count: v.obstacle_count + (type === 'STOP' || type === 'EMERGENCY_STOP' ? 1 : 0)
      });
    }

    if (type !== 'CONTINUE') {
      this.obstacleCount++;
    }

    // Notify callbacks
    this.callbacks.onDecision?.(decision);

    return decision;
  }

  private registerObstacle(x: number, y: number, floorId: string) {
    const obstacle: ObstacleCell = {
      x, y, floor_id: floorId,
      detected_by: this.vehicleId,
      timestamp: Date.now(),
      ttl: 15000 // 15 seconds until obstacle expires
    };
    this.activeObstacles.push(obstacle);
    this.callbacks.onObstacleDetected?.(x, y, floorId, this.vehicleId);
  }

  reset() {
    this.decisionCount = 0;
    this.obstacleCount = 0;
    this.totalLatencyMs = 0;
    this.lastDecision = null;
    this.activeObstacles = [];
  }
}
