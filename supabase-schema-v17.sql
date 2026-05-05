-- Add assigned_to_team column to assets
alter table public.assets add column if not exists assigned_to_team text;
