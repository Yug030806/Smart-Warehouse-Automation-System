import { Vehicle, RouteSegment } from '../database.types';
import mockDb from '../supabase/mockDb';
import { EdgeAIEngine, EdgeAICallbacks, ObstacleCell } from './edgeAIEngine';
import { fleetCoordinator } from './fleetCoordinator';
import { calculateRoute } from '../algorithms/astar';

export interface MoveCommandCallbacks {
  onObstacleWait?: (x: number, y: number, floorId: string, waitDurationSec: number) => void;
  onObstacleCleared?: (x: number, y: number, floorId: string) => void;
  onObstaclePersisted?: (x: number, y: number, floorId: string) => void;
  onReroute?: (newRoute: RouteSegment[]) => void;
  onRerouteFailed?: (x: number, y: number, floorId: string) => void;
  onElevatorEnter?: (floorId: string, x: number, y: number) => void;
  onElevatorExit?: (floorId: string, x: number, y: number) => void;
}

export interface VehicleController {
  connect(): void;
  disconnect(): void;
  sendMoveCommand(
    route: RouteSegment[],
    onUpdate: (x: number, y: number, floorId: string, currentStep: number) => void,
    onComplete: () => void,
    callbacks?: MoveCommandCallbacks
  ): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getStatus(): string;
  getPosition(): { x: number; y: number; floor_id: string };
  setSpeed(multiplier: number): void;
  getEdgeAIStatus(): any;
  setEdgeAICallbacks(callbacks: EdgeAICallbacks): void;
  getCurrentRoute(): RouteSegment[];
  getStepIndex(): number;
  handleFleetObstacleAlert(
    obsX: number,
    obsY: number,
    obsFloor: string,
    sourceVehicleCode: string,
    sourceX: number,
    sourceY: number
  ): { action: 'REROUTED' | 'HALTED_YIELD' | 'IGNORED'; reason?: string; newRoute?: RouteSegment[] };
}

export class SimulatorVehicleController implements VehicleController {
  private vehicleId: string;
  private isConnected: boolean = false;
  private isPaused: boolean = false;
  private isWaitingForObstacle: boolean = false;
  private obstacleWaitTimer: any = null;
  private activeInterval: any = null;
  private speedMultiplier: number = 1;
  private currentRoute: RouteSegment[] = [];
  private stepIndex: number = 0;
  private onUpdateCb: ((x: number, y: number, floorId: string, currentStep: number, totalSteps?: number) => void) | null = null;
  private onCompleteCb: (() => void) | null = null;
  private extraCallbacks: MoveCommandCallbacks = {};
  private allLocations: any[] = [];
  private otherVehicles: any[] = [];
  private initialVehicle: Vehicle | null = null;
  private currentX: number = 0;
  private currentY: number = 0;
  private currentFloorId: string = '';
  private edgeAI: EdgeAIEngine;

  constructor(vehicleId: string, obstacleProbability: number = 0) {
    this.vehicleId = vehicleId;
    this.edgeAI = new EdgeAIEngine(vehicleId, obstacleProbability);
  }

  private getLiveOtherVehicles(): Vehicle[] {
    const live = mockDb.getVehicles().filter(v => v.id !== this.vehicleId && v.status !== 'OFFLINE');
    if (live.length > 0) return live;
    return this.otherVehicles.filter(v => v.id !== this.vehicleId && v.status !== 'OFFLINE');
  }

  setInitialVehicle(veh: Vehicle) {
    this.initialVehicle = veh;
    this.currentX = veh.x_position;
    this.currentY = veh.y_position;
    this.currentFloorId = veh.current_floor_id;
    mockDb.saveVehicle(veh);
  }

  setLocations(locations: any[]) {
    this.allLocations = locations;
  }

  setOtherVehicles(vehicles: any[]) {
    this.otherVehicles = vehicles;
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
    return v ? v.status : (this.initialVehicle ? this.initialVehicle.status : 'OFFLINE');
  }

  getPosition() {
    const v = mockDb.getVehicles().find((x) => x.id === this.vehicleId);
    if (v) return { x: v.x_position, y: v.y_position, floor_id: v.current_floor_id };
    if (this.initialVehicle) return { x: this.initialVehicle.x_position, y: this.initialVehicle.y_position, floor_id: this.initialVehicle.current_floor_id };
    return { x: 0, y: 0, floor_id: '' };
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier;
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
    if (this.obstacleWaitTimer) {
      clearInterval(this.obstacleWaitTimer);
      this.obstacleWaitTimer = null;
    }
    this.currentRoute = [];
    this.stepIndex = 0;
    this.isPaused = false;
    this.isWaitingForObstacle = false;
    this.onUpdateCb = null;
    this.onCompleteCb = null;
    this.extraCallbacks = {};
  }

  getCurrentRoute(): RouteSegment[] {
    return [...this.currentRoute];
  }

  getStepIndex(): number {
    return this.stepIndex;
  }

  handleFleetObstacleAlert(
    obsX: number,
    obsY: number,
    obsFloor: string,
    sourceVehicleCode: string,
    sourceX: number,
    sourceY: number
  ): { action: 'REROUTED' | 'HALTED_YIELD' | 'IGNORED'; reason?: string; newRoute?: RouteSegment[] } {
    if (this.currentRoute.length === 0 || this.stepIndex >= this.currentRoute.length) {
      return { action: 'IGNORED' };
    }

    const curFloor = this.currentFloorId || this.getPosition().floor_id;
    if (curFloor !== obsFloor) {
      return { action: 'IGNORED' };
    }

    const curX = this.currentX;
    const curY = this.currentY;

    // Check if the reported obstacle is on this vehicle's remaining route
    const remainingRoute = this.currentRoute.slice(this.stepIndex);
    const obstacleOnRoute = remainingRoute.some(p => p.x === obsX && p.y === obsY && p.floor_id === obsFloor);

    // Check if reporting AMR is directly on or blocking this AMR's next step
    const nextStep = this.currentRoute[this.stepIndex];
    const reporterBlocksNext = nextStep && nextStep.x === sourceX && nextStep.y === sourceY && nextStep.floor_id === obsFloor;

    if (obstacleOnRoute) {
      // Preemptively reroute around the obstacle!
      const targetPoint = this.currentRoute[this.currentRoute.length - 1];
      const updatedObs = [
        ...fleetCoordinator.getGlobalObstacles(),
        ...this.edgeAI.getActiveObstacles(),
        { x: obsX, y: obsY, floor_id: obsFloor }
      ];

      const newRoute = calculateRoute(
        curFloor,
        curX,
        curY,
        targetPoint.floor_id,
        targetPoint.x,
        targetPoint.y,
        this.allLocations.length > 0 ? this.allLocations : mockDb.getLocations(),
        12,
        8,
        updatedObs,
        this.getLiveOtherVehicles()
      );

      if (newRoute.length > 0) {
        this.currentRoute = newRoute;
        if (newRoute.length > 1 && newRoute[0].x === curX && newRoute[0].y === curY && newRoute[0].floor_id === curFloor) {
          this.stepIndex = 1;
        } else {
          this.stepIndex = 0;
        }
        this.extraCallbacks.onReroute?.(newRoute);
        return { 
          action: 'REROUTED', 
          reason: `Obstacle at [${obsX}, ${obsY}] reported by ${sourceVehicleCode} is on planned route`,
          newRoute 
        };
      } else {
        // Cannot reroute, pause safely
        this.pause();
        this.isWaitingForObstacle = true;
        return { 
          action: 'HALTED_YIELD', 
          reason: `Path blocked by obstacle at [${obsX}, ${obsY}], no alternate path available` 
        };
      }
    }

    const distToReporter = Math.max(Math.abs(curX - sourceX), Math.abs(curY - sourceY));
    const inSensorRange = distToReporter <= 3;
    const nextStepIsNearObstacle = nextStep && (Math.abs(nextStep.x - obsX) <= 1 && Math.abs(nextStep.y - obsY) <= 1) && nextStep.floor_id === obsFloor;

    if (reporterBlocksNext || (inSensorRange && nextStepIsNearObstacle)) {
      // The reporting AMR is stopped directly in front or nearby: halt to maintain safe stopping distance
      this.pause();
      this.isWaitingForObstacle = true;
      return { 
        action: 'HALTED_YIELD', 
        reason: `${sourceVehicleCode} stopped ahead with obstacle at [${obsX}, ${obsY}], yielding to maintain safety distance` 
      };
    }

    return { action: 'IGNORED' };
  }

  notifyObstacleChanged() {
    // If currently waiting for obstacle clearance, check immediately
    if (this.isWaitingForObstacle && this.currentRoute.length > 0 && this.stepIndex < this.currentRoute.length) {
      const point = this.currentRoute[this.stepIndex];
      const activeObstacles = [
        ...fleetCoordinator.getGlobalObstacles(),
        ...this.edgeAI.getActiveObstacles()
      ];
      const liveOtherVehs = this.getLiveOtherVehicles();
      const hasVehicle = liveOtherVehs.some(
        v => v.current_floor_id === point.floor_id && v.x_position === point.x && v.y_position === point.y
      );
      const stillBlocked = activeObstacles.some(o => 
        o.x === point.x && o.y === point.y && o.floor_id === point.floor_id
      ) || hasVehicle;

      if (!stillBlocked && this.obstacleWaitTimer) {
        clearInterval(this.obstacleWaitTimer);
        this.obstacleWaitTimer = null;
        this.isWaitingForObstacle = false;
        this.resume();
        this.extraCallbacks.onObstacleCleared?.(point.x, point.y, point.floor_id);
      }
    }
  }

  sendMoveCommand(
    route: RouteSegment[],
    onUpdate: (x: number, y: number, floorId: string, currentStep: number, totalSteps?: number) => void,
    onComplete: () => void,
    callbacks: MoveCommandCallbacks = {}
  ) {
    this.stop();
    this.currentRoute = route;
    this.stepIndex = 0;
    if (route.length > 0) {
      this.currentX = route[0].x;
      this.currentY = route[0].y;
      this.currentFloorId = route[0].floor_id;
    }
    this.onUpdateCb = onUpdate;
    this.onCompleteCb = onComplete;
    this.extraCallbacks = callbacks;

    this.startLoop();
  }

  private startLoop() {
    const runStep = () => {
      if (this.isPaused || this.isWaitingForObstacle) return;
      if (this.stepIndex >= this.currentRoute.length) {
        const completeCb = this.onCompleteCb;
        this.stop();
        if (completeCb) completeCb();
        return;
      }

      const point = this.currentRoute[this.stepIndex];

      let v = mockDb.getVehicles().find((x) => x.id === this.vehicleId);
      if (!v && this.initialVehicle) {
        v = { ...this.initialVehicle };
        mockDb.saveVehicle(v);
      }

      const currentX = this.currentX;
      const currentY = this.currentY;
      const currentFloor = this.currentFloorId || point.floor_id;

      const nextX = point.x;
      const nextY = point.y;
      const nextFloor = point.floor_id;

      // 1. Check if next cell is blocked by an active obstacle
      const activeObstacles = [
        ...fleetCoordinator.getGlobalObstacles(),
        ...this.edgeAI.getActiveObstacles()
      ];

      const isBlockedByObstacle = activeObstacles.some(o => 
        o.x === nextX && o.y === nextY && o.floor_id === nextFloor
      );

      // 2. Run Edge-AI process step with live vehicle positions
      const liveOtherVehs = this.getLiveOtherVehicles();
      const decision = this.edgeAI.processStep(
        currentX, currentY, nextX, nextY, nextFloor, 
        liveOtherVehs
      );

      // 3. If obstacle encountered (either manual on map or via Edge-AI):
      if (isBlockedByObstacle || decision.decision_type === 'STOP' || decision.decision_type === 'EMERGENCY_STOP' || decision.decision_type === 'REROUTE') {
        this.isWaitingForObstacle = true;
        this.pause();

        const obsX = nextX;
        const obsY = nextY;
        const obsFloor = nextFloor;

        const isVehicle = decision.decision_type === 'EMERGENCY_STOP' && decision.reason.includes('Vehicle');
        if (!isVehicle) {
          fleetCoordinator.reportObstacle(
            {
              x: obsX,
              y: obsY,
              floor_id: obsFloor,
              detected_by: this.vehicleId,
              timestamp: Date.now(),
              ttl: 30000
            },
            this.vehicleId
          );
        }

        // Notify UI to log halt and wait 3s
        this.extraCallbacks.onObstacleWait?.(obsX, obsY, obsFloor, 3);

        let waitMs = 3000;
        const checkIntervalMs = 150;

        if (this.obstacleWaitTimer) clearInterval(this.obstacleWaitTimer);

        this.obstacleWaitTimer = setInterval(() => {
          waitMs -= checkIntervalMs;

          // Check if cell is still blocked by:
          // 1. A global map obstacle (user-placed)
          // 2. An active Edge-AI registered obstacle (camera/LiDAR)
          // 3. Another live active vehicle currently on that cell
          const hasGlobal = fleetCoordinator.getGlobalObstacles().some(
            o => o.x === obsX && o.y === obsY && o.floor_id === obsFloor
          );
          const hasEdge = this.edgeAI.getActiveObstacles().some(
            o => o.x === obsX && o.y === obsY && o.floor_id === obsFloor
          );
          const currentOtherVehs = this.getLiveOtherVehicles();
          const hasVehicle = currentOtherVehs.some(
            v => v.current_floor_id === obsFloor && v.x_position === obsX && v.y_position === obsY
          );

          const stillBlocked = hasGlobal || hasEdge || hasVehicle;

          if (!stillBlocked) {
            // Case A: Obstacle was REMOVED before 3 seconds! (or other vehicle moved away)
            clearInterval(this.obstacleWaitTimer);
            this.obstacleWaitTimer = null;
            this.isWaitingForObstacle = false;
            this.resume();

            // Resume on original route without rerouting
            this.extraCallbacks.onObstacleCleared?.(obsX, obsY, obsFloor);
            return;
          }

          if (waitMs <= 0) {
            // Case B: 3 seconds elapsed and obstacle is STILL present!
            clearInterval(this.obstacleWaitTimer);
            this.obstacleWaitTimer = null;

            this.extraCallbacks.onObstaclePersisted?.(obsX, obsY, obsFloor);

            // Strict continuation from the exact cell where the AMR is stopped
            const curVehX = this.currentX;
            const curVehY = this.currentY;
            const curVehFloor = this.currentFloorId || currentFloor;

            // Ensure mockDb accurately reflects current stopped position
            const vNow = mockDb.getVehicles().find(x => x.id === this.vehicleId);
            if (vNow) {
              mockDb.saveVehicle({
                ...vNow,
                x_position: curVehX,
                y_position: curVehY,
                current_floor_id: curVehFloor
              });
            }

            const targetPoint = this.currentRoute[this.currentRoute.length - 1];
            const updatedObs = [
              ...fleetCoordinator.getGlobalObstacles(),
              ...this.edgeAI.getActiveObstacles(),
              { x: obsX, y: obsY, floor_id: obsFloor }
            ];

            const newRoute = calculateRoute(
              curVehFloor,
              curVehX,
              curVehY,
              targetPoint.floor_id,
              targetPoint.x,
              targetPoint.y,
              this.allLocations.length > 0 ? this.allLocations : mockDb.getLocations(),
              12,
              8,
              updatedObs,
              this.getLiveOtherVehicles()
            );

            if (newRoute.length > 0) {
              this.currentRoute = newRoute;
              // If newRoute starts with the cell where AMR is already stopped, advance to index 1
              // so it immediately moves to the first detour step instead of re-stepping on its current cell!
              if (newRoute.length > 1 && newRoute[0].x === curVehX && newRoute[0].y === curVehY && newRoute[0].floor_id === curVehFloor) {
                this.stepIndex = 1;
              } else {
                this.stepIndex = 0;
              }
              this.isWaitingForObstacle = false;
              this.resume();
              this.extraCallbacks.onReroute?.(newRoute);
            } else {
              this.isWaitingForObstacle = false;
              this.extraCallbacks.onRerouteFailed?.(obsX, obsY, obsFloor);
            }
          }
        }, checkIntervalMs);

        return; // Halt this step!
      }

      // Check for elevator actions
      if (point.action === 'ELEVATOR_ENTER') {
        this.extraCallbacks.onElevatorEnter?.(point.floor_id, point.x, point.y);
      } else if (point.action === 'ELEVATOR_EXIT') {
        this.extraCallbacks.onElevatorExit?.(point.floor_id, point.x, point.y);
      }

      // Update vehicle position in Database / mockDb
      this.currentX = point.x;
      this.currentY = point.y;
      this.currentFloorId = point.floor_id;

      const nextBattery = Math.max(10, (v?.battery_percentage ?? 100) - (Math.random() > 0.85 ? 1 : 0));
      const updatedVehicle: Vehicle = {
        ...(v || this.initialVehicle || {} as Vehicle),
        id: this.vehicleId,
        x_position: point.x,
        y_position: point.y,
        current_floor_id: point.floor_id,
        battery_percentage: nextBattery,
        status: 'BUSY'
      };
      mockDb.saveVehicle(updatedVehicle);

      if (this.onUpdateCb) {
        this.onUpdateCb(point.x, point.y, point.floor_id, this.stepIndex, this.currentRoute.length);
      }
      this.stepIndex++;
    };

    const stepDuration = Math.max(80, Math.floor(750 / this.speedMultiplier));
    this.activeInterval = setInterval(runStep, stepDuration);
  }
}
