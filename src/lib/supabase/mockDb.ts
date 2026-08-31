import { Profile, Warehouse, Floor, Zone, Location, Path, Vehicle, Box, Task, Route, ScanEvent, Alert, AuditLog, Notification, SystemSettings, SensorReading, EdgeAIDecision, FleetMessage } from '../database.types';

// Let's create an in-memory/localStorage seed dataset
export interface MockDbState {
  profiles: Profile[];
  warehouses: Warehouse[];
  floors: Floor[];
  zones: Zone[];
  locations: Location[];
  paths: Path[];
  vehicles: Vehicle[];
  boxes: Box[];
  tasks: Task[];
  routes: Route[];
  scanEvents: ScanEvent[];
  alerts: Alert[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  settings: SystemSettings;
  sensorReadings: SensorReading[];
  edgeAIDecisions: EdgeAIDecision[];
  fleetMessages: FleetMessage[];
}

const W_ID = 'w-01';
const F1_ID = 'f-01';
const F2_ID = 'f-02';
const F3_ID = 'f-03';

const Z1A = 'z-1a';
const Z1B = 'z-1b';
const Z2A = 'z-2a';
const Z2B = 'z-2b';
const Z3C = 'z-3c';
const Z3D = 'z-3d';

// Generate default static structure
const initialWarehouses: Warehouse[] = [
  { id: W_ID, name: 'Autonomous Core Facility 1', address: 'Plot 42, Tech Park, Zone 9', created_at: new Date().toISOString() }
];

const initialFloors: Floor[] = [
  { id: F1_ID, warehouse_id: W_ID, floor_number: 1, name: 'Floor 1 - Inbound & Sorting', grid_width: 12, grid_height: 8 },
  { id: F2_ID, warehouse_id: W_ID, floor_number: 2, name: 'Floor 2 - High Density Storage', grid_width: 12, grid_height: 8 },
  { id: F3_ID, warehouse_id: W_ID, floor_number: 3, name: 'Floor 3 - Outbound & Express', grid_width: 12, grid_height: 8 }
];

const initialZones: Zone[] = [
  { id: Z1A, floor_id: F1_ID, name: 'Zone A - Inbound', code: 'Z1-A', color: '#3b82f6' },
  { id: Z1B, floor_id: F1_ID, name: 'Zone B - Buffer', code: 'Z1-B', color: '#10b981' },
  { id: Z2A, floor_id: F2_ID, name: 'Zone A - Heavy Racks', code: 'Z2-A', color: '#f59e0b' },
  { id: Z2B, floor_id: F2_ID, name: 'Zone B - Light Shelves', code: 'Z2-B', color: '#8b5cf6' },
  { id: Z3C, floor_id: F3_ID, name: 'Zone C - Sorting Lanes', code: 'Z3-C', color: '#ec4899' },
  { id: Z3D, floor_id: F3_ID, name: 'Zone D - Dispatch Dock', code: 'Z3-D', color: '#06b6d4' }
];

// Grid Coordinates:
// Walls are simulated. We lay down locations.
// Floor 1:
// Pickup Point (x: 1, y: 1)
// Rack A1 (x: 3, y: 2), Rack A2 (x: 3, y: 4), Rack A3 (x: 3, y: 6)
// Elevator A (x: 10, y: 4)
// Charging A (x: 5, y: 1)
const initialLocations: Location[] = [
  // Floor 1
  { id: 'loc-f1-pickup', zone_id: Z1A, name: 'Floor 1 Pickup Point', type: 'PICKUP', x: 1, y: 1, floor_id: F1_ID },
  { id: 'loc-f1-rack-a1', zone_id: Z1A, name: 'Rack A1', type: 'RACK', x: 3, y: 2, floor_id: F1_ID },
  { id: 'loc-f1-rack-a2', zone_id: Z1A, name: 'Rack A2', type: 'RACK', x: 3, y: 4, floor_id: F1_ID },
  { id: 'loc-f1-rack-a3', zone_id: Z1A, name: 'Rack A3', type: 'RACK', x: 3, y: 6, floor_id: F1_ID },
  { id: 'loc-f1-charging', zone_id: Z1B, name: 'F1 Charger 1', type: 'CHARGING', x: 5, y: 1, floor_id: F1_ID },
  { id: 'loc-f1-elevator', zone_id: Z1B, name: 'Elevator A', type: 'ELEVATOR', x: 10, y: 4, floor_id: F1_ID },

  // Floor 2
  { id: 'loc-f2-rack-b1', zone_id: Z2A, name: 'Rack B1', type: 'RACK', x: 3, y: 2, floor_id: F2_ID },
  { id: 'loc-f2-rack-b2', zone_id: Z2A, name: 'Rack B2', type: 'RACK', x: 3, y: 4, floor_id: F2_ID },
  { id: 'loc-f2-rack-b3', zone_id: Z2B, name: 'Rack B3', type: 'RACK', x: 3, y: 6, floor_id: F2_ID },
  { id: 'loc-f2-charging', zone_id: Z2B, name: 'F2 Charger 1', type: 'CHARGING', x: 5, y: 1, floor_id: F2_ID },
  { id: 'loc-f2-elevator', zone_id: Z2B, name: 'Elevator A', type: 'ELEVATOR', x: 10, y: 4, floor_id: F2_ID },

  // Floor 3
  { id: 'loc-f3-rack-c1', zone_id: Z3C, name: 'Rack C1', type: 'RACK', x: 3, y: 2, floor_id: F3_ID },
  { id: 'loc-f3-rack-c2', zone_id: Z3C, name: 'Rack C2', type: 'RACK', x: 3, y: 4, floor_id: F3_ID },
  { id: 'loc-f3-rack-c5', zone_id: Z3C, name: 'Rack C5', type: 'RACK', x: 3, y: 6, floor_id: F3_ID },
  { id: 'loc-f3-delivery', zone_id: Z3D, name: 'Floor 3 Delivery Dock', type: 'DELIVERY', x: 8, y: 2, floor_id: F3_ID },
  { id: 'loc-f3-charging', zone_id: Z3D, name: 'F3 Charger 1', type: 'CHARGING', x: 5, y: 1, floor_id: F3_ID },
  { id: 'loc-f3-elevator', zone_id: Z3D, name: 'Elevator A', type: 'ELEVATOR', x: 10, y: 4, floor_id: F3_ID }
];

const initialVehicles: Vehicle[] = [
  { id: 'v-patel', vehicle_code: 'CART-PATEL', name: 'Patel Demo Cart', status: 'AVAILABLE', battery_percentage: 100, current_location_id: 'loc-f1-pickup', current_floor_id: F1_ID, x_position: 1, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 },
  { id: 'v-01', vehicle_code: 'CART-01', name: 'Standard Lifter Alpha', status: 'AVAILABLE', battery_percentage: 95, current_location_id: 'loc-f1-charging', current_floor_id: F1_ID, x_position: 5, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 },
  { id: 'v-02', vehicle_code: 'CART-02', name: 'Pallet Runner Beta', status: 'AVAILABLE', battery_percentage: 80, current_location_id: 'loc-f2-charging', current_floor_id: F2_ID, x_position: 5, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 },
  { id: 'v-03', vehicle_code: 'CART-03', name: 'Mini Shuttle Gamma', status: 'MAINTENANCE', battery_percentage: 42, current_location_id: 'loc-f3-charging', current_floor_id: F3_ID, x_position: 5, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'OFFLINE', sensor_suite_active: false, last_decision_id: null, obstacle_count: 0 },
  { id: 'v-04', vehicle_code: 'CART-04', name: 'High-Speed Rover Delta', status: 'AVAILABLE', battery_percentage: 12, current_location_id: 'loc-f1-pickup', current_floor_id: F1_ID, x_position: 1, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 }
];

// Generate 30 boxes seed data
const initialBoxes: Box[] = Array.from({ length: 30 }, (_, index) => {
  const boxNum = index + 1001;
  const isUrgent = boxNum === 1001; // BX-1001 is URGENT
  const isHigh = boxNum % 5 === 0;
  const priority = isUrgent ? 'URGENT' : (isHigh ? 'HIGH' : 'NORMAL');
  
  // Floor 1 rack a3 is the source for BX-1001
  const current_location_id = isUrgent ? 'loc-f1-rack-a3' : (index % 3 === 0 ? 'loc-f1-rack-a1' : (index % 3 === 1 ? 'loc-f2-rack-b1' : 'loc-f3-rack-c1'));
  const destination_location_id = isUrgent ? 'loc-f3-rack-c5' : (index % 2 === 0 ? 'loc-f3-delivery' : 'loc-f1-rack-a2');

  const code = `BX-${boxNum}`;
  return {
    id: `box-${boxNum}`,
    box_code: code,
    product_name: isUrgent ? 'Core Processor Unit P1' : `General Goods Batch ${boxNum}`,
    category: isUrgent ? 'Electronics' : (index % 2 === 0 ? 'Mechanical' : 'Medical'),
    weight: Math.round((Math.random() * 20 + 2) * 10) / 10,
    current_location_id,
    destination_location_id,
    priority,
    status: 'WAITING',
    qr_code_data: code,
    created_by: 'user-01',
    created_at: new Date(Date.now() - 3600000 * (30 - index)).toISOString(),
    updated_at: new Date().toISOString()
  };
});

// Generate tasks
const initialTasks: Task[] = [
  {
    id: 'task-1001',
    task_code: 'TSK-1001',
    box_id: 'box-1001',
    vehicle_id: null,
    source_location_id: 'loc-f1-rack-a3',
    destination_location_id: 'loc-f3-rack-c5',
    priority: 'URGENT',
    status: 'PENDING',
    priority_score: 110,
    estimated_distance: 18,
    estimated_duration: 180,
    actual_duration: null,
    created_by: 'user-01',
    assigned_at: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 480000).toISOString(), // 8 minutes ago as required by scenario
    updated_at: new Date().toISOString()
  }
];

// Add completed tasks for analytics
for (let i = 2; i <= 15; i++) {
  const box = initialBoxes[i];
  initialTasks.push({
    id: `task-mock-${i}`,
    task_code: `TSK-${1000 + i}`,
    box_id: box.id,
    vehicle_id: 'v-01',
    source_location_id: box.current_location_id,
    destination_location_id: box.destination_location_id,
    priority: box.priority,
    status: 'COMPLETED',
    priority_score: box.priority === 'URGENT' ? 100 : (box.priority === 'HIGH' ? 50 : 10),
    estimated_distance: 12,
    estimated_duration: 120,
    actual_duration: 115,
    created_by: 'user-01',
    assigned_at: new Date(Date.now() - 7200000 * i).toISOString(),
    started_at: new Date(Date.now() - 7000000 * i).toISOString(),
    completed_at: new Date(Date.now() - 6500000 * i).toISOString(),
    created_at: new Date(Date.now() - 7500000 * i).toISOString(),
    updated_at: new Date(Date.now() - 6500000 * i).toISOString()
  });
  box.status = 'DELIVERED';
  box.current_location_id = box.destination_location_id;
}

const initialSettings: SystemSettings = {
  id: 'sys-settings',
  default_speed: 1,
  animation_speed: 1,
  auto_start: true,
  simulation_mode: 'AUTO',
  floor_transition_duration: 3,
  updated_at: new Date().toISOString()
};

// Listeners helper for simulating Realtime updates
type SubType = (table: string, event: string, payload: any) => void;
const subscribers: Set<SubType> = new Set();

class MockDB {
  private state: MockDbState;

  constructor() {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('sih_logistics_mock_db');
      if (cached) {
        try {
          this.state = JSON.parse(cached);
          return;
        } catch {
          // fallback
        }
      }
    }

    this.state = {
      profiles: [
        { id: 'u-admin', full_name: 'Super Admin', email: 'admin@demo.com', role: 'ADMIN', assigned_warehouse_ids: [], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'u-manager', full_name: 'Warehouse Manager', email: 'manager@demo.com', role: 'MANAGER', assigned_warehouse_ids: ['w-01'], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        
        { id: 'u-operator', full_name: 'Cart Operator', email: 'operator@demo.com', role: 'OPERATOR', assigned_warehouse_ids: [], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      warehouses: initialWarehouses,
      floors: initialFloors,
      zones: initialZones,
      locations: initialLocations,
      paths: [],
      vehicles: initialVehicles,
      boxes: initialBoxes,
      tasks: initialTasks,
      routes: [],
      scanEvents: [],
      alerts: [
        { id: 'alert-01', type: 'LOW_BATTERY', severity: 'WARNING', message: 'Vehicle CART-04 has low battery (12%) and requires docking soon.', vehicle_id: 'v-04', is_acknowledged: false, resolved_at: null, created_at: new Date().toISOString() }
      ],
      auditLogs: [
        { id: 'log-01', user_email: 'system', action: 'SEED_DATA', object_type: 'SYSTEM', object_id: 'sys', previous_state: null, new_state: { seeded: true }, timestamp: new Date().toISOString() }
      ],
      notifications: [
        { id: 'notif-01', user_id: 'u-manager', title: 'New Urgent Task Created', message: 'Task TSK-1001 requires attention.', type: 'URGENT_TASK', is_read: false, related_id: 'task-1001', created_at: new Date().toISOString() },
        
        
      ],
      settings: initialSettings,
      sensorReadings: [],
      edgeAIDecisions: [],
      fleetMessages: []
    };
    this.save();
  }

  private save() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sih_logistics_mock_db', JSON.stringify(this.state));
    }
  }

  public notify(table: string, event: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    subscribers.forEach(sub => sub(table, event, payload));
  }

  public subscribe(sub: SubType) {
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }

  // Profiles CRUD
  getProfiles() { return this.state.profiles; }
  saveProfile(p: Profile) {
    const idx = this.state.profiles.findIndex(x => x.id === p.id);
    if (idx >= 0) this.state.profiles[idx] = p;
    else this.state.profiles.push(p);
    this.save();
    this.notify('profiles', idx >= 0 ? 'UPDATE' : 'INSERT', p);
  }

  // Warehouses CRUD
  getWarehouses() { return this.state.warehouses; }
  saveWarehouse(w: Warehouse) {
    const idx = this.state.warehouses.findIndex(x => x.id === w.id);
    if (idx >= 0) this.state.warehouses[idx] = w;
    else this.state.warehouses.push(w);
    this.save();
    this.notify('warehouses', idx >= 0 ? 'UPDATE' : 'INSERT', w);
  }
  deleteWarehouse(id: string) {
    this.state.warehouses = this.state.warehouses.filter(x => x.id !== id);
    this.save();
    this.notify('warehouses', 'DELETE', { id });
  }

  // Floors CRUD
  getFloors() { return this.state.floors; }
  saveFloor(f: Floor) {
    const idx = this.state.floors.findIndex(x => x.id === f.id);
    if (idx >= 0) this.state.floors[idx] = f;
    else this.state.floors.push(f);
    this.save();
    this.notify('floors', idx >= 0 ? 'UPDATE' : 'INSERT', f);
  }
  deleteFloor(id: string) {
    this.state.floors = this.state.floors.filter(x => x.id !== id);
    this.save();
    this.notify('floors', 'DELETE', { id });
  }

  // Zones CRUD
  getZones() { return this.state.zones; }
  saveZone(z: Zone) {
    const idx = this.state.zones.findIndex(x => x.id === z.id);
    if (idx >= 0) this.state.zones[idx] = z;
    else this.state.zones.push(z);
    this.save();
    this.notify('zones', idx >= 0 ? 'UPDATE' : 'INSERT', z);
  }
  deleteZone(id: string) {
    this.state.zones = this.state.zones.filter(x => x.id !== id);
    this.save();
    this.notify('zones', 'DELETE', { id });
  }

  // Locations CRUD
  getLocations() { return this.state.locations; }
  saveLocation(l: Location) {
    const idx = this.state.locations.findIndex(x => x.id === l.id);
    if (idx >= 0) this.state.locations[idx] = l;
    else this.state.locations.push(l);
    this.save();
    this.notify('locations', idx >= 0 ? 'UPDATE' : 'INSERT', l);
  }
  deleteLocation(id: string) {
    this.state.locations = this.state.locations.filter(x => x.id !== id);
    this.save();
    this.notify('locations', 'DELETE', { id });
  }

  // Vehicles CRUD
  getVehicles() { return this.state.vehicles; }
  saveVehicle(v: Vehicle) {
    const idx = this.state.vehicles.findIndex(x => x.id === v.id);
    const prev = idx >= 0 ? { ...this.state.vehicles[idx] } : null;
    if (idx >= 0) {
      this.state.vehicles[idx] = { ...v, updated_at: new Date().toISOString() };
    } else {
      this.state.vehicles.push(v);
    }
    this.save();
    this.notify('vehicles', idx >= 0 ? 'UPDATE' : 'INSERT', v);
  }
  deleteVehicle(id: string) {
    this.state.vehicles = this.state.vehicles.filter(x => x.id !== id);
    this.save();
    this.notify('vehicles', 'DELETE', { id });
  }

  // Boxes CRUD
  getBoxes() { return this.state.boxes; }
  saveBox(b: Box) {
    const idx = this.state.boxes.findIndex(x => x.id === b.id);
    if (idx >= 0) this.state.boxes[idx] = { ...b, updated_at: new Date().toISOString() };
    else this.state.boxes.push(b);
    this.save();
    this.notify('boxes', idx >= 0 ? 'UPDATE' : 'INSERT', b);
  }
  deleteBox(id: string) {
    this.state.boxes = this.state.boxes.filter(x => x.id !== id);
    this.save();
    this.notify('boxes', 'DELETE', { id });
  }

  // Profiles CRUD
  deleteProfile(id: string) {
    this.state.profiles = this.state.profiles.filter(x => x.id !== id);
    this.save();
    this.notify('profiles', 'DELETE', { id });
  }

  // Tasks CRUD
  getTasks() { return this.state.tasks; }
  saveTask(t: Task) {
    const idx = this.state.tasks.findIndex(x => x.id === t.id);
    if (idx >= 0) this.state.tasks[idx] = { ...t, updated_at: new Date().toISOString() };
    else this.state.tasks.push(t);
    this.save();
    this.notify('tasks', idx >= 0 ? 'UPDATE' : 'INSERT', t);
  }
  deleteTask(id: string) {
    this.state.tasks = this.state.tasks.filter(x => x.id !== id);
    this.save();
    this.notify('tasks', 'DELETE', { id });
  }

  // Routes CRUD
  getRoutes() { return this.state.routes; }
  saveRoute(r: Route) {
    const idx = this.state.routes.findIndex(x => x.id === r.id);
    if (idx >= 0) this.state.routes[idx] = r;
    else this.state.routes.push(r);
    this.save();
    this.notify('routes', idx >= 0 ? 'UPDATE' : 'INSERT', r);
  }

  // Scan Events
  getScanEvents() { return this.state.scanEvents; }
  addScanEvent(s: ScanEvent) {
    this.state.scanEvents.push(s);
    this.save();
    this.notify('scan_events', 'INSERT', s);
  }

  // Alerts CRUD
  getAlerts() { return this.state.alerts; }
  saveAlert(a: Alert) {
    const idx = this.state.alerts.findIndex(x => x.id === a.id);
    if (idx >= 0) this.state.alerts[idx] = a;
    else this.state.alerts.push(a);
    this.save();
    this.notify('alerts', idx >= 0 ? 'UPDATE' : 'INSERT', a);
  }
  deleteAlert(id: string) {
    this.state.alerts = this.state.alerts.filter(x => x.id !== id);
    this.save();
    this.notify('alerts', 'DELETE', { id });
  }

  // Audit Logs
  getAuditLogs() { return this.state.auditLogs; }
  addAuditLog(log: AuditLog) {
    this.state.auditLogs.unshift(log); // newest first
    this.save();
    this.notify('audit_logs', 'INSERT', log);
  }

  // Notifications
  getNotifications() { return this.state.notifications; }
  saveNotification(n: Notification) {
    const idx = this.state.notifications.findIndex(x => x.id === n.id);
    if (idx >= 0) this.state.notifications[idx] = n;
    else this.state.notifications.push(n);
    this.save();
    this.notify('notifications', idx >= 0 ? 'UPDATE' : 'INSERT', n);
  }

  // Settings
  getSettings() { return this.state.settings; }
  saveSettings(s: SystemSettings) {
    this.state.settings = { ...s, updated_at: new Date().toISOString() };
    this.save();
    this.notify('system_settings', 'UPDATE', this.state.settings);
  }

  // Edge-AI: Sensor Readings
  getSensorReadings() { return this.state.sensorReadings || []; }
  addSensorReading(r: SensorReading) {
    if (!this.state.sensorReadings) this.state.sensorReadings = [];
    this.state.sensorReadings.push(r);
    // Keep only latest 200 readings to avoid memory bloat
    if (this.state.sensorReadings.length > 200) {
      this.state.sensorReadings = this.state.sensorReadings.slice(-200);
    }
    this.save();
    this.notify('sensor_readings', 'INSERT', r);
  }
  clearSensorReadings() {
    this.state.sensorReadings = [];
    this.save();
  }

  // Edge-AI: Decisions
  getEdgeAIDecisions() { return this.state.edgeAIDecisions || []; }
  addEdgeAIDecision(d: EdgeAIDecision) {
    if (!this.state.edgeAIDecisions) this.state.edgeAIDecisions = [];
    this.state.edgeAIDecisions.push(d);
    if (this.state.edgeAIDecisions.length > 200) {
      this.state.edgeAIDecisions = this.state.edgeAIDecisions.slice(-200);
    }
    this.save();
    this.notify('edge_ai_decisions', 'INSERT', d);
  }
  clearEdgeAIDecisions() {
    this.state.edgeAIDecisions = [];
    this.save();
  }

  // Fleet Coordinator: Messages
  getFleetMessages() { return this.state.fleetMessages || []; }
  addFleetMessage(m: FleetMessage) {
    if (!this.state.fleetMessages) this.state.fleetMessages = [];
    this.state.fleetMessages.push(m);
    if (this.state.fleetMessages.length > 200) {
      this.state.fleetMessages = this.state.fleetMessages.slice(-200);
    }
    this.save();
    this.notify('fleet_messages', 'INSERT', m);
  }
  clearFleetMessages() {
    this.state.fleetMessages = [];
    this.save();
  }

  // Reset entire database to factory defaults
  resetToSeeds() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sih_logistics_mock_db');
    }
    // Re-initialize class state
    this.state = {
      profiles: [
        { id: 'u-admin', full_name: 'Super Admin', email: 'admin@demo.com', role: 'ADMIN', assigned_warehouse_ids: [], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'u-manager', full_name: 'Warehouse Manager', email: 'manager@demo.com', role: 'MANAGER', assigned_warehouse_ids: ['w-01'], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        
        { id: 'u-operator', full_name: 'Cart Operator', email: 'operator@demo.com', role: 'OPERATOR', assigned_warehouse_ids: [], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      warehouses: initialWarehouses,
      floors: initialFloors,
      zones: initialZones,
      locations: initialLocations,
      paths: [],
      vehicles: [
        { id: 'v-patel', vehicle_code: 'CART-PATEL', name: 'Patel Demo Cart', status: 'AVAILABLE', battery_percentage: 100, current_location_id: 'loc-f1-pickup', current_floor_id: F1_ID, x_position: 1, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 },
        { id: 'v-01', vehicle_code: 'CART-01', name: 'Standard Lifter Alpha', status: 'AVAILABLE', battery_percentage: 95, current_location_id: 'loc-f1-charging', current_floor_id: F1_ID, x_position: 5, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 },
        { id: 'v-02', vehicle_code: 'CART-02', name: 'Pallet Runner Beta', status: 'AVAILABLE', battery_percentage: 80, current_location_id: 'loc-f2-charging', current_floor_id: F2_ID, x_position: 5, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 },
        { id: 'v-03', vehicle_code: 'CART-03', name: 'Mini Shuttle Gamma', status: 'MAINTENANCE', battery_percentage: 42, current_location_id: 'loc-f3-charging', current_floor_id: F3_ID, x_position: 5, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'OFFLINE', sensor_suite_active: false, last_decision_id: null, obstacle_count: 0 },
        { id: 'v-04', vehicle_code: 'CART-04', name: 'High-Speed Rover Delta', status: 'AVAILABLE', battery_percentage: 12, current_location_id: 'loc-f1-pickup', current_floor_id: F1_ID, x_position: 1, y_position: 1, speed: 1, current_task_id: null, last_seen: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edge_ai_status: 'ONLINE', sensor_suite_active: true, last_decision_id: null, obstacle_count: 0 }
      ],
      boxes: Array.from({ length: 30 }, (_, index) => {
        const boxNum = index + 1001;
        const isUrgent = boxNum === 1001;
        const isHigh = boxNum % 5 === 0;
        const priority = isUrgent ? 'URGENT' : (isHigh ? 'HIGH' : 'NORMAL');
        const current_location_id = isUrgent ? 'loc-f1-rack-a3' : (index % 3 === 0 ? 'loc-f1-rack-a1' : (index % 3 === 1 ? 'loc-f2-rack-b1' : 'loc-f3-rack-c1'));
        const destination_location_id = isUrgent ? 'loc-f3-rack-c5' : (index % 2 === 0 ? 'loc-f3-delivery' : 'loc-f1-rack-a2');
        const code = `BX-${boxNum}`;
        return {
          id: `box-${boxNum}`,
          box_code: code,
          product_name: isUrgent ? 'Core Processor Unit P1' : `General Goods Batch ${boxNum}`,
          category: isUrgent ? 'Electronics' : (index % 2 === 0 ? 'Mechanical' : 'Medical'),
          weight: Math.round((Math.random() * 20 + 2) * 10) / 10,
          current_location_id,
          destination_location_id,
          priority,
          status: 'WAITING',
          qr_code_data: code,
          created_by: 'user-01',
          created_at: new Date(Date.now() - 3600000 * (30 - index)).toISOString(),
          updated_at: new Date().toISOString()
        };
      }),
      tasks: [
        {
          id: 'task-1001',
          task_code: 'TSK-1001',
          box_id: 'box-1001',
          vehicle_id: null,
          source_location_id: 'loc-f1-rack-a3',
          destination_location_id: 'loc-f3-rack-c5',
          priority: 'URGENT',
          status: 'PENDING',
          priority_score: 110,
          estimated_distance: 18,
          estimated_duration: 180,
          actual_duration: null,
          created_by: 'user-01',
          assigned_at: null,
          started_at: null,
          completed_at: null,
          created_at: new Date(Date.now() - 480000).toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      routes: [],
      scanEvents: [],
      alerts: [
        { id: 'alert-01', type: 'LOW_BATTERY', severity: 'WARNING', message: 'Vehicle CART-04 has low battery (12%) and requires docking soon.', vehicle_id: 'v-04', is_acknowledged: false, resolved_at: null, created_at: new Date().toISOString() }
      ],
      auditLogs: [
        { id: 'log-01', user_email: 'system', action: 'RESET_DEMO', object_type: 'SYSTEM', object_id: 'sys', previous_state: null, new_state: { reset: true }, timestamp: new Date().toISOString() }
      ],
      notifications: [
        { id: 'notif-01', user_id: 'u-manager', title: 'New Urgent Task Created', message: 'Task TSK-1001 requires attention.', type: 'URGENT_TASK', is_read: false, related_id: 'task-1001', created_at: new Date().toISOString() },
        
        
      ],
      settings: initialSettings,
      sensorReadings: [],
      edgeAIDecisions: [],
      fleetMessages: []
    };

    // Add completed tasks for analytics
    for (let i = 2; i <= 15; i++) {
      const box = this.state.boxes[i];
      this.state.tasks.push({
        id: `task-mock-${i}`,
        task_code: `TSK-${1000 + i}`,
        box_id: box.id,
        vehicle_id: 'v-01',
        source_location_id: box.current_location_id,
        destination_location_id: box.destination_location_id,
        priority: box.priority,
        status: 'COMPLETED',
        priority_score: box.priority === 'URGENT' ? 100 : (box.priority === 'HIGH' ? 50 : 10),
        estimated_distance: 12,
        estimated_duration: 120,
        actual_duration: 115,
        created_by: 'user-01',
        assigned_at: new Date(Date.now() - 7200000 * i).toISOString(),
        started_at: new Date(Date.now() - 7000000 * i).toISOString(),
        completed_at: new Date(Date.now() - 6500000 * i).toISOString(),
        created_at: new Date(Date.now() - 7500000 * i).toISOString(),
        updated_at: new Date(Date.now() - 6500000 * i).toISOString()
      });
      box.status = 'DELIVERED';
      box.current_location_id = box.destination_location_id;
    }

    this.save();
    this.notify('system_settings', 'UPDATE', this.state.settings);
  }
}

export const mockDb = new MockDB();
export default mockDb;
