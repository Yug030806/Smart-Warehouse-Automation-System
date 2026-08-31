import { Vehicle, RouteSegment } from '../database.types';
import mockDb from '../supabase/mockDb';
import { EdgeAIEngine, EdgeAICallbacks } from './edgeAIEngine';
import { fleetCoordinator } from './fleetCoordinator';
import { calculateRoute } from '../algorithms/astar';

export interface VehicleController {
  connect(): void;
  disconnect(): void;
  sendMoveCommand(
    route: RouteSegment[],
    onUpdate: (x: number, y: number, floorId: string, currentStep: number) => void,
    onComplete: () => void
  ): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getStatus(): string;
  getPosition(): { x: number; y: number; floor_id: string };
  setSpeed(multiplier: number): void;
  getEdgeAIStatus(): any;
  setEdgeAICallbacks(callbacks: EdgeAICallbacks): void;
}

export class SimulatorVehicleController implements VehicleController {
  private vehicleId: string;
  private isConnected: boolean = false;
  private isPaused: boolean = false;
  private activeInterval: any = null;
  private speedMultiplier: number = 1;
  private currentRoute: RouteSegment[] = [];
  private stepIndex: number = 0;
  private onUpdateCb: ((x: number, y: number, floorId: string, currentStep: number) => void) | null = null;
  private onCompleteCb: (() => void) | null = null;
  private edgeAI: EdgeAIEngine;

  constructor(vehicleId: string, obstacleProbability?: number) {
    this.vehicleId = vehicleId;
    this.edgeAI = new EdgeAIEngine(vehicleId, obstacleProbability);
  }

  setEdgeAICallbacks(callbacks: EdgeAICallbacks) {
    this.edgeAI.setCallbacks(callbacks);
  }

  getEdgeAIStatus() {
    return this.edgeAI.getStatus();
  }

  getEdgeAIEngine() {
    return this.edgeAI;
  }

  connect() {
    this.isConnected = true;
    this.edgeAI.activate();
  }

  disconnect() {
    this.stop();
    this.isConnected = false;
    this.edgeAI.deactivate();
  }

  getStatus(): string {
    const v = mockDb.getVehicles().find((x) => x.id === this.vehicleId);
    return v ? v.status : 'OFFLINE';
  }

  getPosition() {
    const v = mockDb.getVehicles().find((x) => x.id === this.vehicleId);
    return v
      ? { x: v.x_position, y: v.y_position, floor_id: v.current_floor_id }
      : { x: 0, y: 0, floor_id: '' };
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier;
    // If currently running an active route, restart interval with new speed immediately
    if (this.activeInterval && this.onUpdateCb && this.onCompleteCb) {
      clearInterval(this.activeInterval);
      this.startLoop();
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  stop() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    this.currentRoute = [];
    this.stepIndex = 0;
    this.isPaused = false;
    this.onUpdateCb = null;
    this.onCompleteCb = null;
  }

  sendMoveCommand(
    route: RouteSegment[],
    onUpdate: (x: number, y: number, floorId: string, currentStep: number) => void,
    onComplete: () => void
  ) {
    this.stop();
    this.currentRoute = route;
    this.stepIndex = 0;
    this.onUpdateCb = onUpdate;
    this.onCompleteCb = onComplete;

    this.startLoop();
  }

  private startLoop() {
    const runStep = () => {
      if (this.isPaused) return;
      if (this.stepIndex >= this.currentRoute.length) {
        const completeCb = this.onCompleteCb;
        this.stop();
        if (completeCb) completeCb();
        return;
      }

      const point = this.currentRoute[this.stepIndex];

      const v = mockDb.getVehicles().find((x) => x.id === this.vehicleId);
      if (!v) return;

      const currentX = v.x_position;
      const currentY = v.y_position;
      const nextX = point.x;
      const nextY = point.y;
      
      // 1. Run local Edge-AI pipeline for the next cell
      const otherVehicles = mockDb.getVehicles();
      const decision = this.edgeAI.processStep(currentX, currentY, nextX, nextY, point.floor_id, otherVehicles);

      // 2. Execute decision locally (autonomous safety)
      if (decision.decision_type === 'STOP' || decision.decision_type === 'EMERGENCY_STOP') {
        this.pause();
        console.log(`[Edge-AI ${this.vehicleId}] ${decision.decision_type}: ${decision.reason}`);
        
        // 3. Report to Fleet Coordinator for global coordination
        const obstacles = this.edgeAI.getActiveObstacles();
        const latestObstacle = obstacles[obstacles.length - 1];
        if (latestObstacle) {
          fleetCoordinator.reportObstacle(latestObstacle, this.vehicleId);
        }

        // 4. Auto-resume after 3.5 seconds and reroute around the obstacle
        setTimeout(() => {
          if (!this.currentRoute || this.currentRoute.length === 0) return; // was fully stopped
          
          const vNow = mockDb.getVehicles().find((x) => x.id === this.vehicleId);
          if (!vNow) return;

          const targetPoint = this.currentRoute[this.currentRoute.length - 1];
          const activeObs = this.edgeAI.getActiveObstacles();
          
          const newRoute = calculateRoute(
            vNow.current_floor_id,
            vNow.x_position,
            vNow.y_position,
            targetPoint.floor_id,
            targetPoint.x,
            targetPoint.y,
            mockDb.getLocations(),
            12,
            8,
            activeObs
          );

          if (newRoute.length > 0) {
            console.log(`[Edge-AI ${this.vehicleId}] Auto-rerouting after obstacle stop (${newRoute.length} steps)`);
            this.currentRoute = newRoute;
            this.stepIndex = 0;
          } else {
            console.log(`[Edge-AI ${this.vehicleId}] No alternate route found, retrying original path`);
          }

          this.resume();
        }, 3500);

        return; // Halt this step
      }

      if (decision.decision_type === 'REROUTE') {
        console.log(`[Edge-AI ${this.vehicleId}] REROUTE: recalculating path`);
        // Recalculate route using A* with active obstacles
        const targetPoint = this.currentRoute[this.currentRoute.length - 1];
        const activeObstacles = this.edgeAI.getActiveObstacles();
        
        const newRoute = calculateRoute(
          v.current_floor_id,
          v.x_position,
          v.y_position,
          targetPoint.floor_id,
          targetPoint.x,
          targetPoint.y,
          mockDb.getLocations(),
          12,
          8,
          activeObstacles
        );

        if (newRoute.length > 0) {
          this.currentRoute = newRoute;
          this.stepIndex = 0;
          return; // restart loop with new route
        } else {
          // No path available, must STOP
          this.pause();
          console.log(`[Edge-AI ${this.vehicleId}] REROUTE FAILED: No valid path found. Stopping.`);
          return;
        }
      }

      // Check for global fleet conflicts (lane access) before moving
      const conflict = fleetCoordinator.checkAndResolveConflict(
        this.vehicleId, nextX, nextY,
        '', 0, 0, // In full sim, we'd check against all other moving vehicles. For now, just a placeholder.
        point.floor_id
      );

      // Temporary speed adjustment
      let effectiveSpeed = this.speedMultiplier;
      if (decision.decision_type === 'SLOW_DOWN') {
        effectiveSpeed = Math.max(0.1, this.speedMultiplier * 0.5);
      }

      // 4. Update vehicle position in Database
      const nextBattery = Math.max(
        10,
        v.battery_percentage - (Math.random() > 0.8 ? 1 : 0)
      );
      mockDb.saveVehicle({
        ...v,
        x_position: point.x,
        y_position: point.y,
        current_floor_id: point.floor_id,
        battery_percentage: nextBattery,
        status: 'BUSY',
      });

      if (this.onUpdateCb) {
        this.onUpdateCb(point.x, point.y, point.floor_id, this.stepIndex);
      }
      this.stepIndex++;
      
      // Update interval speed dynamically if SLOW_DOWN was applied
      if (decision.decision_type === 'SLOW_DOWN' && this.activeInterval) {
         clearInterval(this.activeInterval);
         const stepDuration = Math.max(50, Math.floor(800 / effectiveSpeed));
         this.activeInterval = setInterval(runStep, stepDuration);
      } else if (effectiveSpeed !== this.speedMultiplier && this.activeInterval) {
         // Reset to normal speed
         clearInterval(this.activeInterval);
         const stepDuration = Math.max(50, Math.floor(800 / this.speedMultiplier));
         this.activeInterval = setInterval(runStep, stepDuration);
      }
    };

    // Calculate step speed based on speed multiplier (800ms base delay divided by multiplier)
    const stepDuration = Math.max(50, Math.floor(800 / this.speedMultiplier));
    this.activeInterval = setInterval(runStep, stepDuration);
  }
}
