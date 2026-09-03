-- Migration: Add ON DELETE SET NULL to vehicle, box, and task location/floor references
-- File: supabase/migrations/20260903000004_cascade_warehouse_deletions.sql

-- 1. vehicles.current_floor_id -> SET NULL when floor is deleted
ALTER TABLE public.vehicles 
  DROP CONSTRAINT IF EXISTS vehicles_current_floor_id_fkey;

ALTER TABLE public.vehicles 
  ADD CONSTRAINT vehicles_current_floor_id_fkey 
  FOREIGN KEY (current_floor_id) REFERENCES public.floors(id) ON DELETE SET NULL;

-- 2. boxes.current_location_id & destination_location_id -> SET NULL when location is deleted
ALTER TABLE public.boxes 
  DROP CONSTRAINT IF EXISTS boxes_current_location_id_fkey,
  DROP CONSTRAINT IF EXISTS boxes_destination_location_id_fkey;

ALTER TABLE public.boxes 
  ADD CONSTRAINT boxes_current_location_id_fkey 
  FOREIGN KEY (current_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.boxes 
  ADD CONSTRAINT boxes_destination_location_id_fkey 
  FOREIGN KEY (destination_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;

-- 3. tasks.source_location_id & destination_location_id -> SET NULL when location is deleted
ALTER TABLE public.tasks 
  DROP CONSTRAINT IF EXISTS tasks_source_location_id_fkey,
  DROP CONSTRAINT IF EXISTS tasks_destination_location_id_fkey;

ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_source_location_id_fkey 
  FOREIGN KEY (source_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_destination_location_id_fkey 
  FOREIGN KEY (destination_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
