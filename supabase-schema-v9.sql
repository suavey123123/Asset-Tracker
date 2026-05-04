-- ============================================================
-- ASSET TRACKER — Software licenses table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.licenses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  vendor text,
  license_key text,
  license_type text default 'Perpetual',
  seats_total integer,
  seats_used integer default 0,
  purchase_date date,
  expiry_date date,
  support_expiry date,
  purchase_cost numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

alter table public.licenses enable row level security;

create policy "Licenses viewable by authenticated users"
  on public.licenses for select using (auth.role() = 'authenticated');

create policy "Admins can manage licenses"
  on public.licenses for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
