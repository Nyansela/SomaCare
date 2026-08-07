-- Add scheduled_time to medications table
alter table public.medications add column if not exists scheduled_time text;
