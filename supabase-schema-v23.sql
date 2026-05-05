-- =============================================
-- MULTI-TENANT SUPPORT
-- =============================================

-- Tenants table
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null, -- e.g. 'nhncorp', 'nhnglobal'
  logo_url text,
  created_at timestamptz default now()
);

-- Add tenant_id to all major tables
alter table public.assets add column if not exists tenant_id uuid references public.tenants(id);
alter table public.employees add column if not exists tenant_id uuid references public.tenants(id);
alter table public.licenses add column if not exists tenant_id uuid references public.tenants(id);
alter table public.sites add column if not exists tenant_id uuid references public.tenants(id);
alter table public.maintenance_records add column if not exists tenant_id uuid references public.tenants(id);
alter table public.asset_requests add column if not exists tenant_id uuid references public.tenants(id);
alter table public.consumables add column if not exists tenant_id uuid references public.tenants(id);
alter table public.activity_log add column if not exists tenant_id uuid references public.tenants(id);

-- Add tenant_id to profiles so users belong to a tenant
alter table public.profiles add column if not exists tenant_id uuid references public.tenants(id);

-- Create the default tenant for existing data
insert into public.tenants (name, slug) values ('NHN Global', 'nhnglobal')
on conflict (slug) do nothing;

-- Assign all existing data to the default tenant
update public.assets set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.employees set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.licenses set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.sites set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.maintenance_records set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.asset_requests set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.consumables set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.activity_log set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;
update public.profiles set tenant_id = (select id from public.tenants where slug = 'nhnglobal') where tenant_id is null;

-- Enable RLS on tenants
alter table public.tenants enable row level security;
create policy "Users can read their own tenant" on public.tenants
  for select using (id = (select tenant_id from public.profiles where id = auth.uid()));

-- Update RLS policies to filter by tenant_id
-- Assets
drop policy if exists "Users can read assets" on public.assets;
create policy "Users can read own tenant assets" on public.assets
  for select using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));
create policy "Admins can write own tenant assets" on public.assets
  for all using (tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Employees
drop policy if exists "Users can read employees" on public.employees;
create policy "Users can read own tenant employees" on public.employees
  for select using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));

-- Sites
drop policy if exists "Users can read sites" on public.sites;
create policy "Users can read own tenant sites" on public.sites
  for select using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()));
