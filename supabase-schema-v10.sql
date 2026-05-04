-- ============================================================
-- ASSET TRACKER — License assignments table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.asset_license_assignments (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  license_id uuid references public.licenses on delete cascade,
  assigned_at timestamptz default now(),
  unique(asset_id, license_id)
);

alter table public.asset_license_assignments enable row level security;

create policy "License assignments viewable by authenticated users"
  on public.asset_license_assignments for select using (auth.role() = 'authenticated');

create policy "Admins can manage license assignments"
  on public.asset_license_assignments for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
