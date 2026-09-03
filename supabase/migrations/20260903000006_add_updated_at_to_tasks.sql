-- Migration: Add updated_at column to tasks table if not exists
-- File: supabase/migrations/20260903000006_add_updated_at_to_tasks.sql

ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
