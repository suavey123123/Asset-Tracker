-- App settings table for shared settings like budgets
create table if not exists public.app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

create policy "Authenticated users can read settings"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

create policy "Admins can write settings"
  on public.app_settings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
