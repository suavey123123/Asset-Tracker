-- ============================================================
-- ASSET TRACKER — Asset tags table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.asset_tags (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  tag text not null,
  created_at timestamptz default now(),
  unique(asset_id, tag)
);

alter table public.asset_tags enable row level security;

create policy "Tags viewable by authenticated users"
  on public.asset_tags for select using (auth.role() = 'authenticated');

create policy "Admins can manage tags"
  on public.asset_tags for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
