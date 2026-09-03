-- Migration: Fix B - Repair Demo Accounts in Supabase Auth (auth.users and auth.identities)
-- File: supabase/migrations/20260903000003_repair_demo_accounts.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  -- 1. Upsert Admin Sarah Jenkins
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'authenticated',
    'authenticated',
    'admin@demo.com',
    crypt('admin123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Sarah Jenkins","role":"ADMIN"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 2. Upsert Manager Marcus Vance
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'authenticated',
    'authenticated',
    'manager@demo.com',
    crypt('manager123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Manager Marcus Vance","role":"MANAGER"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 3. Upsert Operator David Chen
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'authenticated',
    'authenticated',
    'operator@demo.com',
    crypt('operator123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Operator David Chen","role":"OPERATOR"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 4. Clean and re-insert into auth.identities
  DELETE FROM auth.identities WHERE user_id IN (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES 
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    jsonb_build_object('sub', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'email', 'admin@demo.com', 'email_verified', true),
    'email',
    'admin@demo.com',
    NOW(), NOW(), NOW()
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    jsonb_build_object('sub', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'email', 'manager@demo.com', 'email_verified', true),
    'email',
    'manager@demo.com',
    NOW(), NOW(), NOW()
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    jsonb_build_object('sub', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'email', 'operator@demo.com', 'email_verified', true),
    'email',
    'operator@demo.com',
    NOW(), NOW(), NOW()
  );

  -- 5. Sync roles in public.profiles
  UPDATE public.profiles SET role = 'ADMIN', is_active = true WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  UPDATE public.profiles SET role = 'MANAGER', is_active = true WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  UPDATE public.profiles SET role = 'OPERATOR', is_active = true WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

END $$;
