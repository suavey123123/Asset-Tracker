-- ============================================================
-- ASSET TRACKER — Supabase SQL Setup
-- Run this entire file in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  full_name text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. ASSETS TABLE
create table if not exists public.assets (
  id uuid default gen_random_uuid() primary key,
  asset_tag text not null unique,
  name text not null,
  category text not null check (category in ('IT Equipment', 'Tools & Equipment')),
  status text not null default 'Available' check (status in ('Available', 'Checked Out', 'Maintenance', 'Retired')),
  model text,
  serial_number text,
  location text,
  assigned_to text,
  expected_return date,
  purchase_date date,
  purchase_cost numeric(10,2),
  warranty_expiry date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. ACTIVITY LOG TABLE
create table if not exists public.activity_log (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  asset_tag text,
  asset_name text,
  type text not null check (type in ('checkout', 'checkin', 'maintenance', 'note', 'created', 'updated', 'deleted')),
  message text not null,
  performed_by text,
  created_at timestamptz default now()
);

-- 4. MAINTENANCE RECORDS TABLE
create table if not exists public.maintenance_records (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  maintenance_type text not null,
  performed_date date not null,
  performed_by text,
  cost numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

-- 5. ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.activity_log enable row level security;
alter table public.maintenance_records enable row level security;

-- Profiles: users can read all profiles, only update their own
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Assets: everyone authenticated can read; only admins can write
create policy "Assets viewable by authenticated users"
  on public.assets for select using (auth.role() = 'authenticated');

create policy "Admins can insert assets"
  on public.assets for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update assets"
  on public.assets for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete assets"
  on public.assets for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Activity log: everyone reads, only admins write
create policy "Activity log viewable by authenticated users"
  on public.activity_log for select using (auth.role() = 'authenticated');

create policy "Admins can insert activity log"
  on public.activity_log for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Maintenance: everyone reads, only admins write
create policy "Maintenance viewable by authenticated users"
  on public.maintenance_records for select using (auth.role() = 'authenticated');

create policy "Admins can insert maintenance"
  on public.maintenance_records for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update maintenance"
  on public.maintenance_records for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete maintenance"
  on public.maintenance_records for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 6. UPDATED_AT TRIGGER
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger assets_updated_at
  before update on public.assets
  for each row execute procedure public.set_updated_at();
