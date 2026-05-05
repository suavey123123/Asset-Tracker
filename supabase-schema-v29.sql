-- RPC function to get tenant stats bypassing RLS (security definer runs as postgres)
create or replace function public.get_tenant_stats(p_tenant_id uuid)
returns table(assets bigint, emps bigint)
language sql security definer
as $$
  select 
    (select count(*) from public.assets where tenant_id = p_tenant_id) as assets,
    (select count(*) from public.employees where tenant_id = p_tenant_id) as emps;
$$;

-- Grant execute to authenticated users
grant execute on function public.get_tenant_stats(uuid) to authenticated;
