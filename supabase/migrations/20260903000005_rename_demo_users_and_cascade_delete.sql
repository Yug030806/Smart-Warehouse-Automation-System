-- Migration: Rename Demo Users & Add Cascade Rules for User Deletion
-- File: supabase/migrations/20260903000005_rename_demo_users_and_cascade_delete.sql

-- 1. Rename users in public.profiles to generic titles
UPDATE public.profiles 
SET full_name = 'Admin' 
WHERE email = 'admin@demo.com';

UPDATE public.profiles 
SET full_name = 'Manager' 
WHERE email = 'manager@demo.com';

UPDATE public.profiles 
SET full_name = 'AMR Operator' 
WHERE email = 'operator@demo.com';

-- 2. Rename users in auth.users raw_user_meta_data
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"Admin"') 
WHERE email = 'admin@demo.com';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"Manager"') 
WHERE email = 'manager@demo.com';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"AMR Operator"') 
WHERE email = 'operator@demo.com';

-- 3. Add ON DELETE SET NULL to boxes, tasks, scan_events referencing profiles
ALTER TABLE public.boxes 
  DROP CONSTRAINT IF EXISTS boxes_created_by_fkey;

ALTER TABLE public.boxes 
  ADD CONSTRAINT boxes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tasks 
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.scan_events 
  DROP CONSTRAINT IF EXISTS scan_events_scanned_by_fkey;

ALTER TABLE public.scan_events 
  ADD CONSTRAINT scan_events_scanned_by_fkey 
  FOREIGN KEY (scanned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
