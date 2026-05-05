-- Add assigned_to column to license assignments
alter table public.asset_license_assignments
  add column if not exists assigned_to text;
