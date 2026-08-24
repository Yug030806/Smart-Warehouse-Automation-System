export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  created_at: string;
}

export interface Floor {
  id: string;
  warehouse_id: string;
  floor_number: number;
  name: string;
  grid_width: number;
  grid_height: number;
}

export interface Zone {
  id: string;
  floor_id: string;
  name: string;
  code: string;
  color?: string;
}

export interface Location {
  id: string;
  zone_id: string;
  name: string;
  type: 'RACK' | 'PICKUP' | 'DELIVERY' | 'CHARGING' | 'ELEVATOR' | 'WALKWAY';
  x: number;
  y: number;
  floor_id: string;
}

export interface Path {
  id: string;
  floor_id: string;
  from_location_id: string;
  to_location_id: string;
  is_blocked: boolean;
}

export interface Vehicle {
  id: string;
  vehicle_code: string;
  name: string;
  status: 'AVAILABLE' | 'BUSY' | 'CHARGING' | 'MAINTENANCE' | 'OFFLINE' | 'ERROR';
  battery_percentage: number;
  current_location_id: string | null;
  current_floor_id: string;
  x_position: number;
  y_position: number;
  speed: number; // multiplier e.g. 1, 2, 5, 10
  current_task_id: string | null;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface Box {
  id: string;
  box_code: string;
  product_name: string;
  category: string;
  weight: number;
  current_location_id: string;
  destination_location_id: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'WAITING' | 'ASSIGNED' | 'PICKUP_PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  qr_code_data: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  task_code: string;
  box_id: string;
  vehicle_id: string | null;
  source_location_id: string;
  destination_location_id: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'PICKUP_PENDING' | 'PICKED_UP' | 'DELIVERING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  priority_score: number;
  estimated_distance: number;
  estimated_duration: number; // in seconds
  actual_duration: number | null;
  created_by: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteSegment {
  floor_id: string;
  x: number;
  y: number;
  action?: 'PICKUP' | 'DELIVER' | 'ELEVATOR_ENTER' | 'ELEVATOR_EXIT' | 'MOVE';
}

export interface Route {
  id: string;
  task_id: string;
  path_coordinates: RouteSegment[];
  created_at: string;
}

export interface ScanEvent {
  id: string;
  task_id: string;
  box_id: string;
  vehicle_id: string;
  location_id: string;
  scanned_by: string;
  scan_type: 'PICKUP' | 'DELIVERY';
  is_verified: boolean;
  scanned_code: string;
  created_at: string;
}

export interface Alert {
  id: string;
  type: 'URGENT_TASK' | 'LOW_BATTERY' | 'VEHICLE_OFFLINE' | 'ROUTE_BLOCKED' | 'BOX_MISMATCH' | 'DELIVERY_MISMATCH' | 'TASK_FAILED' | 'SYSTEM_ERROR';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  vehicle_id?: string;
  task_id?: string;
  is_acknowledged: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  object_type: string;
  object_id: string;
  previous_state: any;
  new_state: any;
  timestamp: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_id?: string;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  default_speed: number;
  animation_speed: number;
  auto_start: boolean;
  simulation_mode: 'AUTO' | 'MANUAL';
  floor_transition_duration: number; // in seconds
  updated_at: string;
}
