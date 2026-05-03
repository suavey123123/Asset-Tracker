-- ============================================================
-- ASSET TRACKER — Employees table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.employees (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text,
  department text,
  title text,
  phone text,
  location text,
  notes text,
  created_at timestamptz default now()
);

alter table public.employees enable row level security;

create policy "Employees viewable by authenticated users"
  on public.employees for select using (auth.role() = 'authenticated');

create policy "Admins can manage employees"
  on public.employees for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
