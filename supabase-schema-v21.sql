-- Allow admins to delete asset requests
create policy "Admins can delete asset requests"
  on public.asset_requests for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
