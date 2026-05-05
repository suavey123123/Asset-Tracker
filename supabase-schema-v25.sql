-- =============================================
-- FIX TENANT ISOLATION - RLS POLICIES
-- Uses public schema helper instead of auth schema
-- =============================================

-- Helper function in PUBLIC schema (not auth)
create or replace function public.get_tenant_id()
returns uuid language sql stable security definer
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- =============================================
-- ASSETS
-- =============================================
drop policy if exists "Users can read assets" on public.assets;
drop policy if exists "Users can read own tenant assets" on public.assets;
drop policy if exists "Admins can write own tenant assets" on public.assets;
drop policy if exists "Allow all for authenticated" on public.assets;
drop policy if exists "Tenant isolation - assets read" on public.assets;
drop policy if exists "Tenant isolation - assets write" on public.assets;
drop policy if exists "Tenant isolation - assets update" on public.assets;
drop policy if exists "Tenant isolation - assets delete" on public.assets;

create policy "Tenant isolation - assets read" on public.assets
  for select using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation - assets insert" on public.assets
  for insert with check (tenant_id = public.get_tenant_id());

create policy "Tenant isolation - assets update" on public.assets
  for update using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation - assets delete" on public.assets
  for delete using (tenant_id = public.get_tenant_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- =============================================
-- EMPLOYEES
-- =============================================
drop policy if exists "Users can read employees" on public.employees;
drop policy if exists "Users can read own tenant employees" on public.employees;
drop policy if exists "Allow all for authenticated" on public.employees;
drop policy if exists "Tenant isolation - employees read" on public.employees;
drop policy if exists "Tenant isolation - employees write" on public.employees;

create policy "Tenant isolation - employees select" on public.employees
  for select using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation - employees all" on public.employees
  for all using (tenant_id = public.get_tenant_id());

-- =============================================
-- LICENSES
-- =============================================
drop policy if exists "Allow all for authenticated" on public.licenses;
drop policy if exists "Tenant isolation - licenses" on public.licenses;
create policy "Tenant isolation - licenses" on public.licenses
  for all using (tenant_id = public.get_tenant_id());

-- =============================================
-- SITES
-- =============================================
drop policy if exists "Users can read sites" on public.sites;
drop policy if exists "Users can read own tenant sites" on public.sites;
drop policy if exists "Allow all for authenticated" on public.sites;
drop policy if exists "Tenant isolation - sites" on public.sites;
create policy "Tenant isolation - sites" on public.sites
  for all using (tenant_id = public.get_tenant_id());

-- =============================================
-- MAINTENANCE RECORDS
-- =============================================
drop policy if exists "Allow all for authenticated" on public.maintenance_records;
drop policy if exists "Tenant isolation - maintenance" on public.maintenance_records;
create policy "Tenant isolation - maintenance" on public.maintenance_records
  for all using (tenant_id = public.get_tenant_id());

-- =============================================
-- ASSET REQUESTS
-- =============================================
drop policy if exists "Allow all for authenticated" on public.asset_requests;
drop policy if exists "Admins can delete asset requests" on public.asset_requests;
drop policy if exists "Tenant isolation - requests" on public.asset_requests;
create policy "Tenant isolation - requests" on public.asset_requests
  for all using (tenant_id = public.get_tenant_id());

-- =============================================
-- CONSUMABLES
-- =============================================
drop policy if exists "Allow all for authenticated" on public.consumables;
drop policy if exists "Tenant isolation - consumables" on public.consumables;
create policy "Tenant isolation - consumables" on public.consumables
  for all using (tenant_id = public.get_tenant_id());

-- =============================================
-- ACTIVITY LOG
-- =============================================
drop policy if exists "Allow all for authenticated" on public.activity_log;
drop policy if exists "Tenant isolation - activity log" on public.activity_log;
create policy "Tenant isolation - activity log" on public.activity_log
  for all using (tenant_id = public.get_tenant_id());

-- =============================================
-- AUTO-SET TENANT_ID ON INSERT VIA TRIGGER
-- =============================================
create or replace function public.set_tenant_id()
returns trigger language plpgsql security definer
as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.get_tenant_id();
  end if;
  return NEW;
end;
$$;

drop trigger if exists set_tenant_id_assets on public.assets;
create trigger set_tenant_id_assets before insert on public.assets
  for each row execute function public.set_tenant_id();

drop trigger if exists set_tenant_id_employees on public.employees;
create trigger set_tenant_id_employees before insert on public.employees
  for each row execute function public.set_tenant_id();

drop trigger if exists set_tenant_id_licenses on public.licenses;
create trigger set_tenant_id_licenses before insert on public.licenses
  for each row execute function public.set_tenant_id();

drop trigger if exists set_tenant_id_sites on public.sites;
create trigger set_tenant_id_sites before insert on public.sites
  for each row execute function public.set_tenant_id();

drop trigger if exists set_tenant_id_maintenance on public.maintenance_records;
create trigger set_tenant_id_maintenance before insert on public.maintenance_records
  for each row execute function public.set_tenant_id();

drop trigger if exists set_tenant_id_requests on public.asset_requests;
create trigger set_tenant_id_requests before insert on public.asset_requests
  for each row execute function public.set_tenant_id();

drop trigger if exists set_tenant_id_consumables on public.consumables;
create trigger set_tenant_id_consumables before insert on public.consumables
  for each row execute function public.set_tenant_id();

drop trigger if exists set_tenant_id_activity on public.activity_log;
create trigger set_tenant_id_activity before insert on public.activity_log
  for each row execute function public.set_tenant_id();
