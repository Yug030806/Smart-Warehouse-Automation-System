# Supabase Row Level Security (RLS) Architecture & Policy Implementation Plan

## Executive Summary

This document provides a comprehensive design and executable SQL script for implementing **Row Level Security (RLS)** in Supabase for the **Smart Warehouse Autonomous Logistics System (SWL)**. 

The security architecture enforces fine-grained Role-Based Access Control (RBAC) and Warehouse-Level Multi-Tenancy Isolation across all 18 database tables.

---

## 1. Security Architecture & User Roles

### User Role Definitions

| Role | Target Persona | Scope of Access | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | System Administrator | Global / Full System | Full CRUD across all tables, manage user profiles, approve pending registrations, assign warehouse scopes, update global system settings, view/delete audit logs. |
| **`MANAGER`** | Warehouse Manager | Warehouse-Scoped (or All if unassigned) | Full operational CRUD on infrastructure (Floors, Zones, Locations, Paths), Docks, Vehicles, Boxes, Tasks, Routes, and Alerts within assigned warehouses. Read-only on Profiles & Audit Logs. |
| **`OPERATOR`** | AMR Docks & Floor Operator | Warehouse-Scoped Operational | View live telemetry, tasks, maps, vehicles, and boxes. Create/verify Scan Events, update task execution states (`IN_PROGRESS`, `PICKED_UP`, `COMPLETED`), update AMR vehicle status/battery. Cannot edit infrastructure, user profiles, or system settings. |

---

## 2. Table-by-Table Permission Matrix

| Table Name | `ADMIN` Permissions | `MANAGER` Permissions | `OPERATOR` Permissions | Unauthenticated |
| :--- | :--- | :--- | :--- | :--- |
| **`profiles`** | Full CRUD | Read All, Update Self (`auth.uid() = id`) | Read All, Update Self (`auth.uid() = id`) | DENY ALL |
| **`warehouses`** | Full CRUD | Read All, Create/Update Assigned | Read Assigned | DENY ALL |
| **`floors`** | Full CRUD | Read/Write Assigned Warehouse | Read Assigned Warehouse | DENY ALL |
| **`zones`** | Full CRUD | Read/Write Assigned Warehouse | Read Assigned Warehouse | DENY ALL |
| **`locations`** | Full CRUD | Read/Write Assigned Warehouse | Read Assigned Warehouse | DENY ALL |
| **`paths`** | Full CRUD | Read/Write Assigned Warehouse | Read Assigned Warehouse | DENY ALL |
| **`vehicles`** | Full CRUD | Read/Write Assigned Warehouse | Read & Update Status/Battery/Telemetry | DENY ALL |
| **`boxes`** | Full CRUD | Read/Write Assigned Warehouse | Read/Write Assigned Warehouse | DENY ALL |
| **`tasks`** | Full CRUD | Read/Write Assigned Warehouse | Read/Write Status & Execution States | DENY ALL |
| **`routes`** | Full CRUD | Read/Write Assigned Warehouse | Read & Create Route Segments | DENY ALL |
| **`scan_events`** | Full CRUD | Read/Write Assigned Warehouse | Read & Insert Verification Scans | DENY ALL |
| **`alerts`** | Full CRUD | Read & Acknowledge/Resolve | Read & Acknowledge/Resolve | DENY ALL |
| **`audit_logs`** | Read & Insert | Read & Insert Self Activity | Insert Self Activity Only | DENY ALL |
| **`notifications`** | Full CRUD | Read/Update Own (`user_id = auth.uid()`) | Read/Update Own (`user_id = auth.uid()`) | DENY ALL |
| **`system_settings`**| Read/Update | Read Only | Read Only | DENY ALL |
| **`sensor_readings`**| Read/Insert/Delete | Read & Insert (Assigned Docks) | Read & Insert Telemetry | DENY ALL |
| **`edge_ai_decisions`**| Read/Insert/Delete| Read & Insert (Assigned Docks) | Read & Insert Edge Logs | DENY ALL |
| **`fleet_messages`** | Read/Insert/Delete| Read & Insert (Assigned Docks) | Read & Insert Inter-Bot Messages | DENY ALL |

---

## 3. SQL Script: RLS Helper Functions & Security Definer Procedures

Executing direct subqueries against `profiles` inside RLS policies can cause infinite recursion and performance bottlenecks. The helper functions below run with `SECURITY DEFINER` status and `STABLE` volatility for optimal caching and security.

```sql
-- ============================================================================
-- STEP 1: HELPER FUNCTIONS (SECURITY DEFINER)
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
      cardinality(p.assigned_warehouse_ids) = 0 OR
      f.warehouse_id = ANY(p.assigned_warehouse_ids)
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
      cardinality(p.assigned_warehouse_ids) = 0 OR
      f.warehouse_id = ANY(p.assigned_warehouse_ids)
    )
  );
$$;
```

---

## 4. SQL Script: Table-by-Table RLS Policies

```sql
-- ============================================================================
-- STEP 2: ENABLE RLS ON ALL TABLES AND DROP EXISTING POLICIES
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

-- Additional Edge-AI & Fleet tables if present
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
-- 1. PROFILES TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- All active users can view profiles (for display names/collaboration)
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT TO authenticated
  USING (public.is_active_user());

-- Self-registration or Admin insert
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Users can update their own profile; Admins can update any profile (roles/active status)
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Only Admins can delete user profiles
CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================================
-- 2. WAREHOUSES TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "warehouses_select_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_insert_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_update_policy" ON warehouses;
DROP POLICY IF EXISTS "warehouses_delete_policy" ON warehouses;

-- Users can view warehouses they are assigned to (or all if unassigned/Admin)
CREATE POLICY "warehouses_select_policy" ON warehouses
  FOR SELECT TO authenticated
  USING (public.has_warehouse_access(id));

-- Admins and Managers can insert warehouses
CREATE POLICY "warehouses_insert_policy" ON warehouses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin());

-- Admins and Managers with access can update warehouses
CREATE POLICY "warehouses_update_policy" ON warehouses
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin() AND public.has_warehouse_access(id));

-- Only Admins can delete warehouses
CREATE POLICY "warehouses_delete_policy" ON warehouses
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================================
-- 3. FLOORS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "floors_select_policy" ON floors;
DROP POLICY IF EXISTS "floors_insert_policy" ON floors;
DROP POLICY IF EXISTS "floors_update_policy" ON floors;
DROP POLICY IF EXISTS "floors_delete_policy" ON floors;

CREATE POLICY "floors_select_policy" ON floors
  FOR SELECT TO authenticated
  USING (public.has_warehouse_access(warehouse_id));

CREATE POLICY "floors_insert_policy" ON floors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin() AND public.has_warehouse_access(warehouse_id));

CREATE POLICY "floors_update_policy" ON floors
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin() AND public.has_warehouse_access(warehouse_id));

CREATE POLICY "floors_delete_policy" ON floors
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================================
-- 4. ZONES TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "zones_select_policy" ON zones;
DROP POLICY IF EXISTS "zones_insert_policy" ON zones;
DROP POLICY IF EXISTS "zones_update_policy" ON zones;
DROP POLICY IF EXISTS "zones_delete_policy" ON zones;

CREATE POLICY "zones_select_policy" ON zones
  FOR SELECT TO authenticated
  USING (public.has_floor_access(floor_id));

CREATE POLICY "zones_insert_policy" ON zones
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin() AND public.has_floor_access(floor_id));

CREATE POLICY "zones_update_policy" ON zones
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin() AND public.has_floor_access(floor_id));

CREATE POLICY "zones_delete_policy" ON zones
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin() AND public.has_floor_access(floor_id));


-- ============================================================================
-- 5. LOCATIONS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "locations_select_policy" ON locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON locations;
DROP POLICY IF EXISTS "locations_update_policy" ON locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON locations;

CREATE POLICY "locations_select_policy" ON locations
  FOR SELECT TO authenticated
  USING (public.has_floor_access(floor_id));

CREATE POLICY "locations_insert_policy" ON locations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin() AND public.has_floor_access(floor_id));

CREATE POLICY "locations_update_policy" ON locations
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin() AND public.has_floor_access(floor_id));

CREATE POLICY "locations_delete_policy" ON locations
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin() AND public.has_floor_access(floor_id));


-- ============================================================================
-- 6. PATHS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "paths_select_policy" ON paths;
DROP POLICY IF EXISTS "paths_insert_policy" ON paths;
DROP POLICY IF EXISTS "paths_update_policy" ON paths;
DROP POLICY IF EXISTS "paths_delete_policy" ON paths;

CREATE POLICY "paths_select_policy" ON paths
  FOR SELECT TO authenticated
  USING (public.has_floor_access(floor_id));

CREATE POLICY "paths_insert_policy" ON paths
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin() AND public.has_floor_access(floor_id));

CREATE POLICY "paths_update_policy" ON paths
  FOR UPDATE TO authenticated
  USING (public.is_active_user() AND public.has_floor_access(floor_id)); -- Allows Operators to toggle obstacle blocks

CREATE POLICY "paths_delete_policy" ON paths
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin() AND public.has_floor_access(floor_id));


-- ============================================================================
-- 7. VEHICLES TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "vehicles_select_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles;

CREATE POLICY "vehicles_select_policy" ON vehicles
  FOR SELECT TO authenticated
  USING (public.has_floor_access(current_floor_id));

CREATE POLICY "vehicles_insert_policy" ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin());

-- Operators, Managers, and Admins can update vehicle telemetry, position, battery, and status
CREATE POLICY "vehicles_update_policy" ON vehicles
  FOR UPDATE TO authenticated
  USING (public.is_active_user() AND public.has_floor_access(current_floor_id));

CREATE POLICY "vehicles_delete_policy" ON vehicles
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());


-- ============================================================================
-- 8. BOXES TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "boxes_select_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_insert_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_update_policy" ON boxes;
DROP POLICY IF EXISTS "boxes_delete_policy" ON boxes;

CREATE POLICY "boxes_select_policy" ON boxes
  FOR SELECT TO authenticated
  USING (public.has_location_access(current_location_id));

CREATE POLICY "boxes_insert_policy" ON boxes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "boxes_update_policy" ON boxes
  FOR UPDATE TO authenticated
  USING (public.is_active_user());

CREATE POLICY "boxes_delete_policy" ON boxes
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());


-- ============================================================================
-- 9. TASKS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;

CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT TO authenticated
  USING (public.has_location_access(source_location_id));

CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE TO authenticated
  USING (public.is_active_user());

CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());


-- ============================================================================
-- 10. ROUTES TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "routes_select_policy" ON routes;
DROP POLICY IF EXISTS "routes_insert_policy" ON routes;
DROP POLICY IF EXISTS "routes_update_policy" ON routes;
DROP POLICY IF EXISTS "routes_delete_policy" ON routes;

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


-- ============================================================================
-- 11. SCAN_EVENTS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "scan_events_select_policy" ON scan_events;
DROP POLICY IF EXISTS "scan_events_insert_policy" ON scan_events;
DROP POLICY IF EXISTS "scan_events_delete_policy" ON scan_events;

CREATE POLICY "scan_events_select_policy" ON scan_events
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "scan_events_insert_policy" ON scan_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "scan_events_delete_policy" ON scan_events
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================================
-- 12. ALERTS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "alerts_select_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_insert_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_update_policy" ON alerts;
DROP POLICY IF EXISTS "alerts_delete_policy" ON alerts;

CREATE POLICY "alerts_select_policy" ON alerts
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "alerts_insert_policy" ON alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

-- Active users can acknowledge/resolve system alerts
CREATE POLICY "alerts_update_policy" ON alerts
  FOR UPDATE TO authenticated
  USING (public.is_active_user());

CREATE POLICY "alerts_delete_policy" ON alerts
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================================
-- 13. AUDIT_LOGS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

-- Active users can view logs; Admins see all logs
CREATE POLICY "audit_logs_select_policy" ON audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_user());

-- System components & users can append audit logs
CREATE POLICY "audit_logs_insert_policy" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

-- Strict Audit Trail: NO UPDATE POLICY (Audit logs are immutable)

-- Only Admins can purge audit logs
CREATE POLICY "audit_logs_delete_policy" ON audit_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================================
-- 14. NOTIFICATIONS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

-- Users can only read notifications directed to them or broadcasts
CREATE POLICY "notifications_select_policy" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_insert_policy" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

-- Users can update (mark as read) their own notifications
CREATE POLICY "notifications_update_policy" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_delete_policy" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());


-- ============================================================================
-- 15. SYSTEM_SETTINGS TABLE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "system_settings_select_policy" ON system_settings;
DROP POLICY IF EXISTS "system_settings_update_policy" ON system_settings;

CREATE POLICY "system_settings_select_policy" ON system_settings
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY "system_settings_update_policy" ON system_settings
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin());


-- ============================================================================
-- 16. SENSOR_READINGS / EDGE-AI / FLEET TABLES (IF PRESENT)
-- ============================================================================
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
```

---

## 5. Deployment & Execution Guide

To deploy these RLS policies to your live Supabase project:

1. Log in to the [Supabase Dashboard](https://database.new).
2. Navigate to your project -> **SQL Editor**.
3. Create a new query, paste the SQL script from Section 3 & 4 above, and click **Run**.
4. Alternatively, using the **Supabase CLI**:
   ```bash
   supabase db execute --file ./supabase-schema.sql
   ```

---

## 6. Verification & Security Testing Commands

After running the SQL script, test the policies using the following SQL test assertions in the Supabase SQL Editor:

```sql
-- Test 1: Verify RLS is enabled on all target tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN (
  'profiles', 'warehouses', 'floors', 'zones', 'locations', 
  'paths', 'vehicles', 'boxes', 'tasks', 'routes', 'scan_events', 
  'alerts', 'audit_logs', 'notifications', 'system_settings'
);

-- Test 2: Verify helper function execution
SELECT public.get_auth_role(), public.is_admin(), public.is_manager_or_admin();
```
