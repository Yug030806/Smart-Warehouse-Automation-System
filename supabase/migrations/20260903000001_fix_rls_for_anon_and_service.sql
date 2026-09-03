-- ============================================================================
-- SMART WAREHOUSE AUTONOMOUS SYSTEM (SWL) - RLS FIX SCRIPT
-- Description: Grants anon and authenticated roles proper access for web client
-- File: supabase/migrations/20260903000001_fix_rls_for_anon_and_service.sql
-- ============================================================================

-- 1. WAREHOUSES
DROP POLICY IF EXISTS "warehouses_select_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_insert_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_update_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_delete_policy" ON warehouses;
DROP POLICY IF EXISTS "Allow read warehouses" ON warehouses;
DROP POLICY IF EXISTS "Allow manage warehouses" ON warehouses;

CREATE POLICY "warehouses_select_policy" ON warehouses
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "warehouses_insert_policy" ON warehouses
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "warehouses_update_policy" ON warehouses
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "warehouses_delete_policy" ON warehouses
  FOR DELETE TO anon, authenticated
  USING (true);

-- 2. FLOORS
DROP POLICY IF EXISTS "floors_select_policy" ON floors;
DROP POLICY IF EXISTS "floors_insert_policy" ON floors;
DROP POLICY IF EXISTS "floors_update_policy" ON floors;
DROP POLICY IF EXISTS "floors_delete_policy" ON floors;
DROP POLICY IF EXISTS "Allow read floors" ON floors;
DROP POLICY IF EXISTS "Allow manage floors" ON floors;

CREATE POLICY "floors_select_policy" ON floors
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "floors_insert_policy" ON floors
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "floors_update_policy" ON floors
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "floors_delete_policy" ON floors
  FOR DELETE TO anon, authenticated
  USING (true);

-- 3. ZONES
DROP POLICY IF EXISTS "zones_select_policy" ON zones;
DROP POLICY IF EXISTS "zones_insert_policy" ON zones;
DROP POLICY IF EXISTS "zones_update_policy" ON zones;
DROP POLICY IF EXISTS "zones_delete_policy" ON zones;
DROP POLICY IF EXISTS "Allow read zones" ON zones;
DROP POLICY IF EXISTS "Allow manage zones" ON zones;

CREATE POLICY "zones_select_policy" ON zones
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "zones_insert_policy" ON zones
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "zones_update_policy" ON zones
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "zones_delete_policy" ON zones
  FOR DELETE TO anon, authenticated
  USING (true);

-- 4. LOCATIONS
DROP POLICY IF EXISTS "locations_select_policy" ON locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON locations;
DROP POLICY IF EXISTS "locations_update_policy" ON locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON locations;
DROP POLICY IF EXISTS "Allow read locations" ON locations;
DROP POLICY IF EXISTS "Allow manage locations" ON locations;

CREATE POLICY "locations_select_policy" ON locations
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "locations_insert_policy" ON locations
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "locations_update_policy" ON locations
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "locations_delete_policy" ON locations
  FOR DELETE TO anon, authenticated
  USING (true);

-- 5. PATHS
DROP POLICY IF EXISTS "paths_select_policy" ON paths;
DROP POLICY IF EXISTS "paths_insert_policy" ON paths;
DROP POLICY IF EXISTS "paths_update_policy" ON paths;
DROP POLICY IF EXISTS "paths_delete_policy" ON paths;
DROP POLICY IF EXISTS "Allow read paths" ON paths;
DROP POLICY IF EXISTS "Allow manage paths" ON paths;

CREATE POLICY "paths_select_policy" ON paths
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "paths_insert_policy" ON paths
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "paths_update_policy" ON paths
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "paths_delete_policy" ON paths
  FOR DELETE TO anon, authenticated
  USING (true);

-- 6. VEHICLES
DROP POLICY IF EXISTS "vehicles_select_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles;
DROP POLICY IF EXISTS "Allow read vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow manage vehicles" ON vehicles;

CREATE POLICY "vehicles_select_policy" ON vehicles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "vehicles_insert_policy" ON vehicles
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "vehicles_update_policy" ON vehicles
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "vehicles_delete_policy" ON vehicles
  FOR DELETE TO anon, authenticated
  USING (true);

-- 7. BOXES
DROP POLICY IF EXISTS "boxes_select_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_insert_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_update_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_delete_policy" ON boxes;
DROP POLICY IF EXISTS "Allow read boxes" ON boxes;
DROP POLICY IF EXISTS "Allow manage boxes" ON boxes;

CREATE POLICY "boxes_select_policy" ON boxes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "boxes_insert_policy" ON boxes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "boxes_update_policy" ON boxes
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "boxes_delete_policy" ON boxes
  FOR DELETE TO anon, authenticated
  USING (true);

-- 8. TASKS
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;
DROP POLICY IF EXISTS "Allow read tasks" ON tasks;
DROP POLICY IF EXISTS "Allow manage tasks" ON tasks;

CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE TO anon, authenticated
  USING (true);

-- 9. ROUTES
DROP POLICY IF EXISTS "routes_select_policy" ON routes;
DROP POLICY IF EXISTS "routes_insert_policy" ON routes;
DROP POLICY IF EXISTS "routes_update_policy" ON routes;
DROP POLICY IF EXISTS "routes_delete_policy" ON routes;
DROP POLICY IF EXISTS "Allow read routes" ON routes;
DROP POLICY IF EXISTS "Allow manage routes" ON routes;

CREATE POLICY "routes_select_policy" ON routes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "routes_insert_policy" ON routes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "routes_update_policy" ON routes
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "routes_delete_policy" ON routes
  FOR DELETE TO anon, authenticated
  USING (true);

-- 10. SCAN_EVENTS
DROP POLICY IF EXISTS "scan_events_select_policy" ON scan_events;
DROP POLICY IF EXISTS "scan_events_insert_policy" ON scan_events;
DROP POLICY IF EXISTS "scan_events_delete_policy" ON scan_events;
DROP POLICY IF EXISTS "Allow read scans" ON scan_events;
DROP POLICY IF EXISTS "Allow manage scans" ON scan_events;

CREATE POLICY "scan_events_select_policy" ON scan_events
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "scan_events_insert_policy" ON scan_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "scan_events_delete_policy" ON scan_events
  FOR DELETE TO anon, authenticated
  USING (true);

-- 11. ALERTS
DROP POLICY IF EXISTS "alerts_select_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_insert_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_update_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_delete_policy" ON alerts;
DROP POLICY IF EXISTS "Allow read alerts" ON alerts;
DROP POLICY IF EXISTS "Allow manage alerts" ON alerts;

CREATE POLICY "alerts_select_policy" ON alerts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "alerts_insert_policy" ON alerts
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "alerts_update_policy" ON alerts
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "alerts_delete_policy" ON alerts
  FOR DELETE TO anon, authenticated
  USING (true);

-- 12. AUDIT_LOGS
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;
DROP POLICY IF EXISTS "Allow read logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow write logs" ON audit_logs;

CREATE POLICY "audit_logs_select_policy" ON audit_logs
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "audit_logs_insert_policy" ON audit_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "audit_logs_delete_policy" ON audit_logs
  FOR DELETE TO anon, authenticated
  USING (true);

-- 13. NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;
DROP POLICY IF EXISTS "Allow user read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON notifications;

CREATE POLICY "notifications_select_policy" ON notifications
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "notifications_insert_policy" ON notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_update_policy" ON notifications
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "notifications_delete_policy" ON notifications
  FOR DELETE TO anon, authenticated
  USING (true);

-- 14. SYSTEM_SETTINGS
DROP POLICY IF EXISTS "system_settings_select_policy" ON system_settings;
DROP POLICY IF EXISTS "system_settings_update_policy" ON system_settings;
DROP POLICY IF EXISTS "Allow read settings" ON system_settings;
DROP POLICY IF EXISTS "Allow update settings" ON system_settings;

CREATE POLICY "system_settings_select_policy" ON system_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "system_settings_update_policy" ON system_settings
  FOR UPDATE TO anon, authenticated
  USING (true);

-- 15. PROFILES
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Allow update for users themselves or Admins" ON profiles;
DROP POLICY IF EXISTS "Allow delete for Admin" ON profiles;
DROP POLICY IF EXISTS "Allow insert for Admin" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE TO anon, authenticated
  USING (true);
