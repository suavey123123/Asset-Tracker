-- ============================================================
-- ASSET TRACKER v4 — Additional tables
-- Run this in Supabase Dashboard > SQL Editor
-- (Run AFTER the original supabase-schema.sql)
-- ============================================================

-- 1. ASSET COMMENTS
create table if not exists public.asset_comments (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  message text not null,
  author text,
  created_at timestamptz default now()
);

alter table public.asset_comments enable row level security;

create policy "Comments viewable by authenticated users"
  on public.asset_comments for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert comments"
  on public.asset_comments for insert
  with check (auth.role() = 'authenticated');

-- 2. CUSTOM FIELDS
create table if not exists public.asset_custom_fields (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  field_key text not null,
  field_value text,
  created_at timestamptz default now()
);

alter table public.asset_custom_fields enable row level security;

create policy "Custom fields viewable by authenticated users"
  on public.asset_custom_fields for select using (auth.role() = 'authenticated');

create policy "Admins can manage custom fields"
  on public.asset_custom_fields for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 3. ADD NOTIFICATION COLUMNS TO PROFILES
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists notify_overdue boolean default true,
  add column if not exists notify_warranty boolean default true;

-- 4. STORAGE BUCKET FOR PHOTOS
-- Run this separately in Supabase Dashboard > Storage > New bucket
-- Name: asset-photos, Public: true
