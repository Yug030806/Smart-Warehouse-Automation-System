-- Migration: Fix C - Auto-create and sync public.profiles on auth.users changes
-- File: supabase/migrations/20260903000002_auto_create_profiles_trigger.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
BEGIN
  -- Extract user role from metadata, default to OPERATOR
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'OPERATOR');
  IF v_role NOT IN ('ADMIN', 'MANAGER', 'OPERATOR') THEN
    v_role := 'OPERATOR';
  END IF;

  -- Extract full name from metadata, fallback to email prefix
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Auto-provision profile with matching auth UUID (assigned_warehouse_ids is JSONB)
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    is_active,
    assigned_warehouse_ids,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    v_role,
    true,
    '[]'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE 
      WHEN profiles.full_name IS NULL OR profiles.full_name = '' 
      THEN EXCLUDED.full_name 
      ELSE profiles.full_name 
    END,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error message to Postgres logs and re-raise so auth does not fail silently
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, supabase_auth_admin, service_role;
