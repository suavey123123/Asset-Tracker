-- ============================================================
-- ASSET TRACKER — Atomic license seat functions
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Atomic increment (prevents race conditions)
create or replace function public.increment_license_seats(license_id uuid)
returns void as $$
  update public.licenses
  set seats_used = coalesce(seats_used, 0) + 1
  where id = license_id;
$$ language sql security definer;

-- Atomic decrement (never goes below 0)
create or replace function public.decrement_license_seats(license_id uuid)
returns void as $$
  update public.licenses
  set seats_used = greatest(coalesce(seats_used, 1) - 1, 0)
  where id = license_id;
$$ language sql security definer;
