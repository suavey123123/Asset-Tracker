-- ============================================================
-- ASSET TRACKER — Sites table + site_id on employees
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.sites (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  city text,
  state text,
  country text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

alter table public.sites enable row level security;

create policy "Sites viewable by authenticated users"
  on public.sites for select using (auth.role() = 'authenticated');

create policy "Admins can manage sites"
  on public.sites for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Add site_id to employees
alter table public.employees
  add column if not exists site_id uuid references public.sites on delete set null;
