-- Add blocked column to profiles
alter table public.profiles add column if not exists blocked boolean default false;
