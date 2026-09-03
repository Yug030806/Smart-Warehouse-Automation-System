-- ============================================================================
-- SMART WAREHOUSE AUTONOMOUS SYSTEM (SWL) - SUPABASE RLS MIGRATION SCRIPT
-- Description: Complete Row Level Security (RLS) policies and RBAC security design
-- File: supabase/migrations/20260903000000_enable_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- SECTION 1: SECURITY DEFINER HELPER FUNCTIONS
-- High performance, non-recursive helper functions for role & warehouse authorization
-- ============================================================================

-- Function: Get current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true;
$$;

-- Function: Check if user is an active Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = true
  );
$$;

-- Function: Check if user is a Manager or Admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER') AND is_active = true
  );
$$;

-- Function: Check if user has active authenticated session
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_active = true
  );
$$;

-- Function: Check if user has access to a specific warehouse ID
CREATE OR REPLACE FUNCTION public.has_warehouse_access(w_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true AND (
      role = 'ADMIN' OR
      assigned_warehouse_ids IS NULL OR
      assigned_warehouse_ids::text IN ('[]', '{}', 'null', '') OR
      assigned_warehouse_ids::text LIKE '%' || w_id::text || '%'
    )
  );
$$;

-- Function: Check floor-level access via warehouse relation
CREATE OR REPLACE FUNCTION public.has_floor_access(f_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM floors f
    JOIN profiles p ON p.id = auth.uid()
    WHERE f.id = f_id AND p.is_active = true AND (
      p.role = 'ADMIN' OR
      p.assigned_warehouse_ids IS NULL OR
      p.assigned_warehouse_ids::text IN ('[]', '{}', 'null', '') OR
      p.assigned_warehouse_ids::text LIKE '%' || f.warehouse_id::text || '%'
    )
  );
$$;

-- Function: Check location-level access via floor/warehouse relation
CREATE OR REPLACE FUNCTION public.has_location_access(loc_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM locations l
    JOIN floors f ON f.id = l.floor_id
    JOIN profiles p ON p.id = auth.uid()
    WHERE l.id = loc_id AND p.is_active = true AND (
      p.role = 'ADMIN' OR
      p.assigned_warehouse_ids IS NULL OR
      p.assigned_warehouse_ids::text IN ('[]', '{}', 'null', '') OR
      p.assigned_warehouse_ids::text LIKE '%' || f.warehouse_id::text || '%'
    )
  );
$$;


-- ============================================================================
-- SECTION 2: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sensor_readings') THEN
    ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'edge_ai_decisions') THEN
    ALTER TABLE edge_ai_decisions ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fleet_messages') THEN
    ALTER TABLE fleet_messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;


-- ============================================================================
-- SECTION 3: TABLE-BY-TABLE ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Drop NEW policies (if re-running migration)
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
-- Drop OLD policies from original schema
DROP POLICY IF EXISTS "Allow read for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Allow update for users themselves or Admins" ON profiles;
DROP POLICY IF EXISTS "Allow delete for Admin" ON profiles;
DROP POLICY IF EXISTS "Allow insert for Admin" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 2. WAREHOUSES TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Drop NEW policies (if re-running migration)
DROP POLICY IF EXISTS "warehouses_select_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_insert_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_update_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_delete_policy" ON warehouses;
-- Drop OLD policies from original schema
DROP POLICY IF EXISTS "Allow read warehouses" ON warehouses;
DROP POLICY IF EXISTS "Allow manage warehouses" ON warehouses;

CREATE POLICY "warehouses_select_policy" ON warehouses
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_warehouse_access(id));

CREATE POLICY "warehouses_insert_policy" ON warehouses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin());

CREATE POLICY "warehouses_update_policy" ON warehouses
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_manager_or_admin() AND public.has_warehouse_access(id)));

CREATE POLICY "warehouses_delete_policy" ON warehouses
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 3. FLOORS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Drop NEW policies (if re-running migration)
DROP POLICY IF EXISTS "floors_select_policy" ON floors;
DROP POLICY IF EXISTS "floors_insert_policy" ON floors;
DROP POLICY IF EXISTS "floors_update_policy" ON floors;
DROP POLICY IF EXISTS "floors_delete_policy" ON floors;
-- Drop OLD policies from original schema
DROP POLICY IF EXISTS "Allow read floors" ON floors;
DROP POLICY IF EXISTS "Allow manage floors" ON floors;

CREATE POLICY "floors_select_policy" ON floors
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_warehouse_access(warehouse_id));

CREATE POLICY "floors_insert_policy" ON floors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_manager_or_admin() AND public.has_warehouse_access(warehouse_id)));

CREATE POLICY "floors_update_policy" ON floors
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_manager_or_admin() AND public.has_warehouse_access(warehouse_id)));

CREATE POLICY "floors_delete_policy" ON floors
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 4. ZONES TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Drop NEW policies (if re-running migration)
DROP POLICY IF EXISTS "zones_select_policy" ON zones;
DROP POLICY IF EXISTS "zones_insert_policy" ON zones;
DROP POLICY IF EXISTS "zones_update_policy" ON zones;
DROP POLICY IF EXISTS "zones_delete_policy" ON zones;
-- Drop OLD policies from original schema
DROP POLICY IF EXISTS "Allow read zones" ON zones;
DROP POLICY IF EXISTS "Allow manage zones" ON zones;

CREATE POLICY "zones_select_policy" ON zones
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_floor_access(floor_id));

CREATE POLICY "zones_insert_policy" ON zones
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));

CREATE POLICY "zones_update_policy" ON zones
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));

CREATE POLICY "zones_delete_policy" ON zones
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));


-- ----------------------------------------------------------------------------
-- 5. LOCATIONS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Drop NEW policies (if re-running migration)
DROP POLICY IF EXISTS "locations_select_policy" ON locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON locations;
DROP POLICY IF EXISTS "locations_update_policy" ON locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON locations;
-- Drop OLD policies from original schema
DROP POLICY IF EXISTS "Allow read locations" ON locations;
DROP POLICY IF EXISTS "Allow manage locations" ON locations;

CREATE POLICY "locations_select_policy" ON locations
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_floor_access(floor_id));

CREATE POLICY "locations_insert_policy" ON locations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));

CREATE POLICY "locations_update_policy" ON locations
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));

CREATE POLICY "locations_delete_policy" ON locations
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));


-- ----------------------------------------------------------------------------
-- 6. PATHS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Drop NEW policies (if re-running migration)
DROP POLICY IF EXISTS "paths_select_policy" ON paths;
DROP POLICY IF EXISTS "paths_insert_policy" ON paths;
DROP POLICY IF EXISTS "paths_update_policy" ON paths;
DROP POLICY IF EXISTS "paths_delete_policy" ON paths;
-- Drop OLD policies from original schema
DROP POLICY IF EXISTS "Allow read paths" ON paths;
DROP POLICY IF EXISTS "Allow manage paths" ON paths;

CREATE POLICY "paths_select_policy" ON paths
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_floor_access(floor_id));

CREATE POLICY "paths_insert_policy" ON paths
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));

CREATE POLICY "paths_update_policy" ON paths
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_active_user() AND public.has_floor_access(floor_id)));

CREATE POLICY "paths_delete_policy" ON paths
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_manager_or_admin() AND public.has_floor_access(floor_id)));


-- ----------------------------------------------------------------------------
-- 7. VEHICLES TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "vehicles_select_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles;
DROP POLICY IF EXISTS "Allow read vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow manage vehicles" ON vehicles;

CREATE POLICY "vehicles_select_policy" ON vehicles
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_floor_access(current_floor_id));

CREATE POLICY "vehicles_insert_policy" ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin());

CREATE POLICY "vehicles_update_policy" ON vehicles
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_active_user() AND public.has_floor_access(current_floor_id)));

CREATE POLICY "vehicles_delete_policy" ON vehicles
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());


-- ----------------------------------------------------------------------------
-- 8. BOXES TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "boxes_select_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_insert_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_update_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_delete_policy" ON boxes;
DROP POLICY IF EXISTS "Allow read boxes" ON boxes;
DROP POLICY IF EXISTS "Allow manage boxes" ON boxes;

CREATE POLICY "boxes_select_policy" ON boxes
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_location_access(current_location_id));

CREATE POLICY "boxes_insert_policy" ON boxes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "boxes_update_policy" ON boxes
  FOR UPDATE TO authenticated
  USING (public.is_active_user());

CREATE POLICY "boxes_delete_policy" ON boxes
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());


-- ----------------------------------------------------------------------------
-- 9. TASKS TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;
DROP POLICY IF EXISTS "Allow read tasks" ON tasks;
DROP POLICY IF EXISTS "Allow manage tasks" ON tasks;

CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_location_access(source_location_id));

CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE TO authenticated
  USING (public.is_active_user());

CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());


-- ----------------------------------------------------------------------------
-- 10. ROUTES TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "routes_select_policy" ON routes;
DROP POLICY IF EXISTS "routes_insert_policy" ON routes;
DROP POLICY IF EXISTS "routes_update_policy" ON routes;
DROP POLICY IF EXISTS "routes_delete_policy" ON routes;
DROP POLICY IF EXISTS "Allow read routes" ON routes;
DROP POLICY IF EXISTS "Allow manage routes" ON routes;

CREATE POLICY "routes_select_policy" ON routes
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "routes_insert_policy" ON routes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "routes_update_policy" ON routes
  FOR UPDATE TO authenticated
  USING (public.is_active_user());

CREATE POLICY "routes_delete_policy" ON routes
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());


-- ----------------------------------------------------------------------------
-- 11. SCAN_EVENTS TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "scan_events_select_policy" ON scan_events;
DROP POLICY IF EXISTS "scan_events_insert_policy" ON scan_events;
DROP POLICY IF EXISTS "scan_events_delete_policy" ON scan_events;
DROP POLICY IF EXISTS "Allow read scans" ON scan_events;
DROP POLICY IF EXISTS "Allow manage scans" ON scan_events;

CREATE POLICY "scan_events_select_policy" ON scan_events
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "scan_events_insert_policy" ON scan_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "scan_events_delete_policy" ON scan_events
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 12. ALERTS TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "alerts_select_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_insert_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_update_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_delete_policy" ON alerts;
DROP POLICY IF EXISTS "Allow read alerts" ON alerts;
DROP POLICY IF EXISTS "Allow manage alerts" ON alerts;

CREATE POLICY "alerts_select_policy" ON alerts
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "alerts_insert_policy" ON alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "alerts_update_policy" ON alerts
  FOR UPDATE TO authenticated
  USING (public.is_active_user());

CREATE POLICY "alerts_delete_policy" ON alerts
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 13. AUDIT_LOGS TABLE POLICIES (IMMUTABLE LOGS - NO UPDATE POLICY)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;
DROP POLICY IF EXISTS "Allow read logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow write logs" ON audit_logs;

CREATE POLICY "audit_logs_select_policy" ON audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "audit_logs_insert_policy" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "audit_logs_delete_policy" ON audit_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 14. NOTIFICATIONS TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;
DROP POLICY IF EXISTS "Allow user read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON notifications;

CREATE POLICY "notifications_select_policy" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_insert_policy" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "notifications_update_policy" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_delete_policy" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());


-- ----------------------------------------------------------------------------
-- 15. SYSTEM_SETTINGS TABLE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "system_settings_select_policy" ON system_settings;
DROP POLICY IF EXISTS "system_settings_update_policy" ON system_settings;
DROP POLICY IF EXISTS "Allow read settings" ON system_settings;
DROP POLICY IF EXISTS "Allow update settings" ON system_settings;

CREATE POLICY "system_settings_select_policy" ON system_settings
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "system_settings_update_policy" ON system_settings
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin());


-- ----------------------------------------------------------------------------
-- 16. SENSOR_READINGS / EDGE-AI / FLEET TABLES (DYNAMIC COMPATIBILITY)
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sensor_readings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "sensor_readings_select" ON sensor_readings;';
    EXECUTE 'DROP POLICY IF EXISTS "sensor_readings_insert" ON sensor_readings;';
    EXECUTE 'CREATE POLICY "sensor_readings_select" ON sensor_readings FOR SELECT TO authenticated USING (public.is_active_user());';
    EXECUTE 'CREATE POLICY "sensor_readings_insert" ON sensor_readings FOR INSERT TO authenticated WITH CHECK (public.is_active_user());';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'edge_ai_decisions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "edge_ai_decisions_select" ON edge_ai_decisions;';
    EXECUTE 'DROP POLICY IF EXISTS "edge_ai_decisions_insert" ON edge_ai_decisions;';
    EXECUTE 'CREATE POLICY "edge_ai_decisions_select" ON edge_ai_decisions FOR SELECT TO authenticated USING (public.is_active_user());';
    EXECUTE 'CREATE POLICY "edge_ai_decisions_insert" ON edge_ai_decisions FOR INSERT TO authenticated WITH CHECK (public.is_active_user());';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fleet_messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "fleet_messages_select" ON fleet_messages;';
    EXECUTE 'DROP POLICY IF EXISTS "fleet_messages_insert" ON fleet_messages;';
    EXECUTE 'CREATE POLICY "fleet_messages_select" ON fleet_messages FOR SELECT TO authenticated USING (public.is_active_user());';
    EXECUTE 'CREATE POLICY "fleet_messages_insert" ON fleet_messages FOR INSERT TO authenticated WITH CHECK (public.is_active_user());';
  END IF;
END $$;
