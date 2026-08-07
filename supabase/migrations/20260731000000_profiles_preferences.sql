-- Add preferences JSONB column to profiles for user settings
-- (theme, appearance, notifications, fitness suggestions, etc.)
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;
