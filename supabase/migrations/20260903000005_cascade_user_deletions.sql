-- Migration: Add ON DELETE SET NULL to boxes, tasks, scan_events created_by / scanned_by referencing profiles
-- File: supabase/migrations/20260903000005_cascade_user_deletions.sql

-- 1. boxes.created_by -> SET NULL when profile is deleted
ALTER TABLE public.boxes 
  DROP CONSTRAINT IF EXISTS boxes_created_by_fkey;

ALTER TABLE public.boxes 
  ADD CONSTRAINT boxes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. tasks.created_by -> SET NULL when profile is deleted
ALTER TABLE public.tasks 
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. scan_events.scanned_by -> SET NULL when profile is deleted
ALTER TABLE public.scan_events 
  DROP CONSTRAINT IF EXISTS scan_events_scanned_by_fkey;

ALTER TABLE public.scan_events 
  ADD CONSTRAINT scan_events_scanned_by_fkey 
  FOREIGN KEY (scanned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
