-- ============================================================
-- ASSET TRACKER v14 — Consumables tracking
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.consumables (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text default 'Other',
  quantity integer not null default 0,
  min_quantity integer default 0,
  unit text default 'pcs',
  location text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.consumable_log (
  id uuid default gen_random_uuid() primary key,
  consumable_id uuid references public.consumables on delete cascade,
  name text,
  change integer not null,
  new_quantity integer not null,
  type text default 'use',
  note text,
  performed_by text,
  created_at timestamptz default now()
);

alter table public.consumables enable row level security;
alter table public.consumable_log enable row level security;

create policy "Consumables viewable by authenticated users"
  on public.consumables for select using (auth.role() = 'authenticated');

create policy "Admins can manage consumables"
  on public.consumables for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Consumable log viewable by authenticated users"
  on public.consumable_log for select using (auth.role() = 'authenticated');

create policy "Admins can manage consumable log"
  on public.consumable_log for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
