-- Add helpdesk ticket fields to maintenance_records
alter table public.maintenance_records add column if not exists ticket_number text;
alter table public.maintenance_records add column if not exists ticket_url text;
alter table public.maintenance_records add column if not exists ticket_system text;

-- Add accent_color to tenants
alter table public.tenants add column if not exists accent_color text;
