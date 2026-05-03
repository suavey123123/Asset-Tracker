-- ============================================================
-- ASSET TRACKER — Add specs column to assets
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Add specs JSONB column to assets table
alter table public.assets
  add column if not exists specs jsonb default '{}'::jsonb;
