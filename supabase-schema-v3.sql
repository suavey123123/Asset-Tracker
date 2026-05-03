-- ============================================================
-- ASSET TRACKER v5 — Transfer table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.asset_transfers (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  asset_tag text,
  asset_name text,
  from_person text,
  to_person text not null,
  reason text,
  transferred_by text,
  created_at timestamptz default now()
);

alter table public.asset_transfers enable row level security;

create policy "Transfers viewable by authenticated users"
  on public.asset_transfers for select using (auth.role() = 'authenticated');

create policy "Admins can insert transfers"
  on public.asset_transfers for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
