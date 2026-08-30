-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
  assigned_warehouse_ids UUID[],
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow update for users themselves or Admins" ON profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Allow delete for Admin" ON profiles
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Allow insert for Admin" ON profiles
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );


-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read warehouses" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage warehouses" ON warehouses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
);


-- Create floors table
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  grid_width INTEGER DEFAULT 12 NOT NULL,
  grid_height INTEGER DEFAULT 8 NOT NULL
);

ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read floors" ON floors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage floors" ON floors FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
);


-- Create zones table
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read zones" ON zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage zones" ON zones FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
);


-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('RACK', 'PICKUP', 'DELIVERY', 'CHARGING', 'ELEVATOR', 'WALKWAY')),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read locations" ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage locations" ON locations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
);


-- Create paths table
CREATE TABLE IF NOT EXISTS paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  to_location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  is_blocked BOOLEAN DEFAULT FALSE NOT NULL
);

ALTER TABLE paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read paths" ON paths FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage paths" ON paths FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
);


-- Create vehicles table
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

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read vehicles" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update vehicles" ON vehicles FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'OPERATOR'))
);
CREATE POLICY "Allow manage vehicles" ON vehicles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
);


-- Create boxes table
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

ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read boxes" ON boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage boxes" ON boxes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'OPERATOR'))
);


-- Create tasks table
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

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage tasks" ON tasks FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'OPERATOR'))
);


-- Create routes table
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  path_coordinates JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read routes" ON routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage routes" ON routes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'OPERATOR'))
);


-- Create scan_events table
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

ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read scans" ON scan_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage scans" ON scan_events FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'OPERATOR'))
);


-- Create alerts table
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

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read alerts" ON alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manage alerts" ON alerts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'OPERATOR'))
);


-- Create audit_logs table
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

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read logs" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);


-- Create notifications table
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

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow update notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);


-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_speed NUMERIC DEFAULT 1 NOT NULL,
  animation_speed NUMERIC DEFAULT 1 NOT NULL,
  auto_start BOOLEAN DEFAULT FALSE NOT NULL,
  simulation_mode TEXT DEFAULT 'AUTO' NOT NULL CHECK (simulation_mode IN ('AUTO', 'MANUAL')),
  floor_transition_duration INTEGER DEFAULT 3 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read settings" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update settings" ON system_settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'))
);


