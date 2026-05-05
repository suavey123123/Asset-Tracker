-- Allow admins to insert/update/delete tenants
create policy "Admins can manage tenants"
  on public.tenants for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
