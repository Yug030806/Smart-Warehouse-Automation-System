-- ========================================================
-- SMART WAREHOUSE AUTOMATION SYSTEM - ROBUST SETUP & DEMO SEED
-- Target: PostgreSQL / Supabase SQL Editor
-- Topological creation order guarantees no cascading transaction drops
-- ========================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ========================================================
-- SECTION 1: SCHEMA TABLE CREATIONS (Topological Order)
-- ========================================================

-- 1. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_speed NUMERIC DEFAULT 1 NOT NULL,
  animation_speed NUMERIC DEFAULT 1 NOT NULL,
  auto_start BOOLEAN DEFAULT FALSE NOT NULL,
  simulation_mode TEXT DEFAULT 'AUTO' NOT NULL CHECK (simulation_mode IN ('AUTO', 'MANUAL')),
  floor_transition_duration INTEGER DEFAULT 3 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Floors
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  grid_width INTEGER DEFAULT 12 NOT NULL,
  grid_height INTEGER DEFAULT 8 NOT NULL
);

-- 4. Zones
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT
);

-- 5. Locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('RACK', 'PICKUP', 'DELIVERY', 'CHARGING', 'ELEVATOR', 'WALKWAY')),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE
);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS floor_id UUID REFERENCES floors(id) ON DELETE CASCADE;

-- 6. Paths
CREATE TABLE IF NOT EXISTS paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  to_location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  is_blocked BOOLEAN DEFAULT FALSE NOT NULL
);

-- 7. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'OPERATOR')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- 8. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'BUSY', 'CHARGING', 'MAINTENANCE', 'OFFLINE', 'ERROR')),
  battery_percentage INTEGER DEFAULT 100 NOT NULL,
  current_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  current_floor_id UUID REFERENCES floors(id),
  x_position INTEGER NOT NULL,
  y_position INTEGER NOT NULL,
  speed NUMERIC DEFAULT 1 NOT NULL,
  current_task_id UUID,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_floor_id UUID REFERENCES floors(id);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_task_id UUID;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS speed NUMERIC DEFAULT 1 NOT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS battery_percentage INTEGER DEFAULT 100 NOT NULL;

-- 9. Boxes
CREATE TABLE IF NOT EXISTS boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_code TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  current_location_id UUID REFERENCES locations(id),
  destination_location_id UUID REFERENCES locations(id),
  priority TEXT NOT NULL CHECK (priority IN ('NORMAL', 'HIGH', 'URGENT')),
  status TEXT NOT NULL CHECK (status IN ('WAITING', 'ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED')),
  qr_code_data TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS current_location_id UUID REFERENCES locations(id);
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS destination_location_id UUID REFERENCES locations(id);
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS qr_code_data TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- 10. Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code TEXT UNIQUE NOT NULL,
  box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  source_location_id UUID REFERENCES locations(id),
  destination_location_id UUID REFERENCES locations(id),
  priority TEXT NOT NULL CHECK (priority IN ('NORMAL', 'HIGH', 'URGENT')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING', 'PICKED_UP', 'DELIVERING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  priority_score INTEGER DEFAULT 0 NOT NULL,
  estimated_distance NUMERIC NOT NULL,
  estimated_duration INTEGER NOT NULL,
  actual_duration INTEGER,
  created_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES boxes(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_location_id UUID REFERENCES locations(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS destination_location_id UUID REFERENCES locations(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_distance NUMERIC DEFAULT 0 NOT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_duration INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 11. Routes
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  path_coordinates JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS path_coordinates JSONB;

-- 12. Scan Events
CREATE TABLE IF NOT EXISTS scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  scanned_by UUID REFERENCES profiles(id),
  scan_type TEXT NOT NULL CHECK (scan_type IN ('PICKUP', 'DELIVERY')),
  is_verified BOOLEAN DEFAULT TRUE NOT NULL,
  scanned_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 13. Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('URGENT_TASK', 'LOW_BATTERY', 'VEHICLE_OFFLINE', 'ROUTE_BLOCKED', 'BOX_MISMATCH', 'DELIVERY_MISMATCH', 'TASK_FAILED', 'SYSTEM_ERROR')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  message TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 14. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 15. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- ========================================================
-- SECTION 2: DEMO SEED DATA INSERTS
-- ========================================================

-- 1. System Settings
INSERT INTO system_settings (id, default_speed, animation_speed, auto_start, simulation_mode, floor_transition_duration)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 1.5, 1.0, true, 'AUTO', 3)
ON CONFLICT (id) DO NOTHING;

-- 2. Optional Auth Users Population
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES 
      ('00000000-0000-0000-0000-000000000000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'authenticated', 'authenticated', 'admin@demo.com', crypt('admin123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', NOW(), NOW()),
      ('00000000-0000-0000-0000-000000000000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'authenticated', 'authenticated', 'manager@demo.com', crypt('manager123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Manager"}', NOW(), NOW()),
      ('00000000-0000-0000-0000-000000000000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'authenticated', 'authenticated', 'operator@demo.com', crypt('operator123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"AMR Operator"}', NOW(), NOW()),
      ('00000000-0000-0000-0000-000000000000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'authenticated', 'authenticated', 'elena@demo.com', crypt('operator123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"AMR Operator"}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore auth table insert errors if auth schema is locked/managed
  NULL;
END $$;

-- 3. Profiles
INSERT INTO profiles (id, full_name, email, role, avatar_url, is_active)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Admin', 'admin@demo.com', 'ADMIN', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Manager', 'manager@demo.com', 'MANAGER', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'AMR Operator', 'operator@demo.com', 'OPERATOR', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'AMR Operator', 'elena@demo.com', 'OPERATOR', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', true)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

-- 4. Warehouses
INSERT INTO warehouses (id, name, address)
VALUES 
  ('b1111111-1111-1111-1111-111111111111', 'Central Logistics Hub A1', '100 Autonomous Way, Silicon Valley, CA'),
  ('b2222222-2222-2222-2222-222222222222', 'Depot West Distribution', '500 Cargo Parkway, Seattle, WA')
ON CONFLICT (id) DO NOTHING;

-- 5. Floors
INSERT INTO floors (id, warehouse_id, floor_number, name, grid_width, grid_height)
VALUES 
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 1, 'Ground Floor - Receiving & Storage', 12, 8),
  ('c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 2, 'Second Level - Express Dispatch', 12, 8)
ON CONFLICT (id) DO NOTHING;

-- 6. Zones
INSERT INTO zones (id, floor_id, name, code, color)
VALUES 
  ('d1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Receiving Bay', 'Z-REC', '#3b82f6'),
  ('d2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'High Density Racks A', 'Z-RKA', '#10b981'),
  ('d3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'Delivery Bay', 'Z-DEL', '#f59e0b'),
  ('d4444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', 'AGV Charging Hub', 'Z-CHG', '#8b5cf6')
ON CONFLICT (id) DO NOTHING;

-- 7. Locations
INSERT INTO locations (id, zone_id, name, type, x, y, floor_id)
VALUES 
  ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Pickup Dock 1', 'PICKUP', 1, 1, 'c1111111-1111-1111-1111-111111111111'),
  ('e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Pickup Dock 2', 'PICKUP', 1, 3, 'c1111111-1111-1111-1111-111111111111'),
  ('e3333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222', 'Storage Rack A1', 'RACK', 5, 2, 'c1111111-1111-1111-1111-111111111111'),
  ('e4444444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222', 'Storage Rack A2', 'RACK', 5, 5, 'c1111111-1111-1111-1111-111111111111'),
  ('e5555555-5555-5555-5555-555555555555', 'd3333333-3333-3333-3333-333333333333', 'Delivery Station 1', 'DELIVERY', 10, 2, 'c1111111-1111-1111-1111-111111111111'),
  ('e6666666-6666-6666-6666-666666666666', 'd3333333-3333-3333-3333-333333333333', 'Delivery Station 2', 'DELIVERY', 10, 6, 'c1111111-1111-1111-1111-111111111111'),
  ('e7777777-7777-7777-7777-777777777777', 'd4444444-4444-4444-4444-444444444444', 'Fast Charger Alpha', 'CHARGING', 2, 7, 'c1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- 8. Paths
INSERT INTO paths (id, floor_id, from_location_id, to_location_id, is_blocked)
VALUES 
  ('f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', false),
  ('f2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', 'e5555555-5555-5555-5555-555555555555', false)
ON CONFLICT (id) DO NOTHING;

-- 9. Vehicles (AGVs)
INSERT INTO vehicles (id, vehicle_code, name, status, battery_percentage, current_location_id, current_floor_id, x_position, y_position, speed)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'AGV-101', 'Heavy Payload Transporter', 'AVAILABLE', 92, 'e1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 1, 1, 1.2),
  ('22222222-2222-2222-2222-222222222222', 'AGV-102', 'Express Tote Shuttle', 'BUSY', 68, 'e3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 5, 2, 1.5),
  ('33333333-3333-3333-3333-333333333333', 'AGV-103', 'Robotic Pallet Mover', 'CHARGING', 24, 'e7777777-7777-7777-7777-777777777777', 'c1111111-1111-1111-1111-111111111111', 2, 7, 1.0),
  ('44444444-4444-4444-4444-444444444444', 'AGV-104', 'Micro Pallet Shuttle', 'MAINTENANCE', 100, 'e2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 1, 3, 1.0)
ON CONFLICT (id) DO NOTHING;

-- 10. Boxes (Cargo Packages)
INSERT INTO boxes (id, box_code, product_name, category, weight, current_location_id, destination_location_id, priority, status, qr_code_data, created_by)
VALUES 
  ('21111111-1111-1111-1111-111111111111', 'BOX-8801', 'High-Precision Microchips Batch A', 'Electronics', 14.5, 'e1111111-1111-1111-1111-111111111111', 'e5555555-5555-5555-5555-555555555555', 'URGENT', 'ASSIGNED', 'QR-BOX-8801-URGENT-ELECTRONICS', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  ('22222222-2222-2222-2222-222222222222', 'BOX-8802', 'LiPo Battery Packs 48V', 'Power Units', 38.0, 'e2222222-2222-2222-2222-222222222222', 'e6666666-6666-6666-6666-666666666666', 'HIGH', 'WAITING', 'QR-BOX-8802-HIGH-POWER', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
  ('23333333-3333-3333-3333-333333333333', 'BOX-8803', 'Hydraulic Pump Assemblies', 'Mechanical', 62.0, 'e3333333-3333-3333-3333-333333333333', 'e5555555-5555-5555-5555-555555555555', 'NORMAL', 'IN_TRANSIT', 'QR-BOX-8803-NORMAL-MECH', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33')
ON CONFLICT (id) DO NOTHING;

-- 11. Tasks (AGV Dispatch Missions)
INSERT INTO tasks (id, task_code, box_id, vehicle_id, source_location_id, destination_location_id, priority, status, priority_score, estimated_distance, estimated_duration, created_by, assigned_at, started_at)
VALUES 
  ('31111111-1111-1111-1111-111111111111', 'TSK-9001', '21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'e5555555-5555-5555-5555-555555555555', 'URGENT', 'ASSIGNED', 95, 18.5, 120, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NOW(), NOW()),
  ('32222222-2222-2222-2222-222222222222', 'TSK-9002', '23333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'e3333333-3333-3333-3333-333333333333', 'e5555555-5555-5555-5555-555555555555', 'NORMAL', 'IN_PROGRESS', 50, 12.0, 80, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 12. Alerts
INSERT INTO alerts (id, type, severity, message, vehicle_id, task_id, is_acknowledged)
VALUES 
  ('61111111-1111-1111-1111-111111111111', 'LOW_BATTERY', 'WARNING', 'AGV-103 battery dropped to 24%. Rerouted automatically to Fast Charger Alpha.', '33333333-3333-3333-3333-333333333333', NULL, true),
  ('62222222-2222-2222-2222-222222222222', 'URGENT_TASK', 'CRITICAL', 'Task TSK-9001 (BOX-8801 Microchips) pending immediate pickup at Dock 1.', '11111111-1111-1111-1111-111111111111', '31111111-1111-1111-1111-111111111111', false)
ON CONFLICT (id) DO NOTHING;
