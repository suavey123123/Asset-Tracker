-- Add provision_date column to assets
alter table public.assets add column if not exists provision_date date;
