-- ============================================================
-- ASSET TRACKER — Lifecycle tracking table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.asset_lifecycle (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  asset_tag text,
  asset_name text,
  stage text not null,
  notes text,
  changed_by text,
  changed_at timestamptz default now()
);

alter table public.asset_lifecycle enable row level security;

create policy "Lifecycle viewable by authenticated users"
  on public.asset_lifecycle for select using (auth.role() = 'authenticated');

create policy "Admins can insert lifecycle events"
  on public.asset_lifecycle for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Backfill existing assets with their current stage
insert into public.asset_lifecycle (asset_id, asset_tag, asset_name, stage, changed_by)
select id, asset_tag, name, status, 'system'
from public.assets
on conflict do nothing;
