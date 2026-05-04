-- Add quick_note column to assets
alter table public.assets add column if not exists quick_note text;
