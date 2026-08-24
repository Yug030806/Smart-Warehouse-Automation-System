import { Vehicle, RouteSegment } from '../database.types';
import mockDb from '../supabase/mockDb';

export interface VehicleController {
  connect(): void;
  disconnect(): void;
  sendMoveCommand(route: RouteSegment[], onUpdate: (x: number, y: number, floorId: string, currentStep: number) => void, onComplete: () => void): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getStatus(): string;
  getPosition(): { x: number; y: number; floor_id: string };
  setSpeed(multiplier: number): void;
}

export class SimulatorVehicleController implements VehicleController {
  private vehicleId: string;
  private isConnected: boolean = false;
  private isPaused: boolean = false;
  private activeInterval: any = null;
  private speedMultiplier: number = 1;
  private currentRoute: RouteSegment[] = [];
  private stepIndex: number = 0;

  constructor(vehicleId: string) {
    this.vehicleId = vehicleId;
  }

  connect() {
    this.isConnected = true;
  }

  disconnect() {
    this.stop();
    this.isConnected = false;
  }

  getStatus(): string {
    const v = mockDb.getVehicles().find(x => x.id === this.vehicleId);
    return v ? v.status : 'OFFLINE';
  }

  getPosition() {
    const v = mockDb.getVehicles().find(x => x.id === this.vehicleId);
    return v 
      ? { x: v.x_position, y: v.y_position, floor_id: v.current_floor_id } 
      : { x: 0, y: 0, floor_id: '' };
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier;
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
  }

  sendMoveCommand(
    route: RouteSegment[],
    onUpdate: (x: number, y: number, floorId: string, currentStep: number) => void,
    onComplete: () => void
  ) {
    this.stop();
    this.currentRoute = route;
    this.stepIndex = 0;

    const runStep = () => {
      if (this.isPaused) return;
      if (this.stepIndex >= this.currentRoute.length) {
        this.stop();
        onComplete();
        return;
      }

      const point = this.currentRoute[this.stepIndex];
      
      // Update vehicle positions in Database
      const v = mockDb.getVehicles().find(x => x.id === this.vehicleId);
      if (v) {
        const nextBattery = Math.max(10, v.battery_percentage - (Math.random() > 0.8 ? 1 : 0));
        mockDb.saveVehicle({
          ...v,
          x_position: point.x,
          y_position: point.y,
          current_floor_id: point.floor_id,
          battery_percentage: nextBattery,
          status: 'BUSY'
        });
      }

      onUpdate(point.x, point.y, point.floor_id, this.stepIndex);
      this.stepIndex++;
    };

    // Calculate step speed based on default simulation speed settings and multiplier
    const stepDuration = 800 / this.speedMultiplier;
    this.activeInterval = setInterval(runStep, stepDuration);
  }
}
