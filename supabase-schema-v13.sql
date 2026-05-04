-- ============================================================
-- ASSET TRACKER — Asset requests + scheduled maintenance
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Asset requests table
create table if not exists public.asset_requests (
  id uuid default gen_random_uuid() primary key,
  requester_name text not null,
  category text,
  urgency text default 'Normal',
  notes text,
  status text default 'pending' check (status in ('pending','approved','denied')),
  submitted_by text,
  reviewed_by text,
  review_note text,
  reviewed_at timestamptz,
  assigned_asset_id uuid references public.assets on delete set null,
  assigned_asset_tag text,
  created_at timestamptz default now()
);

alter table public.asset_requests enable row level security;

create policy "Requests viewable by authenticated users"
  on public.asset_requests for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert requests"
  on public.asset_requests for insert with check (auth.role() = 'authenticated');

create policy "Admins can update requests"
  on public.asset_requests for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Maintenance schedules table
create table if not exists public.maintenance_schedules (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references public.assets on delete cascade,
  maintenance_type text not null,
  frequency text default 'Yearly',
  next_date date not null,
  last_done date,
  assigned_to text,
  notes text,
  created_by text,
  created_at timestamptz default now()
);

alter table public.maintenance_schedules enable row level security;

create policy "Schedules viewable by authenticated users"
  on public.maintenance_schedules for select using (auth.role() = 'authenticated');

create policy "Admins can manage schedules"
  on public.maintenance_schedules for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
