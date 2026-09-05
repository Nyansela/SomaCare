-- Subscription tiers for gated AI features (SomaCare Plus / Family).
-- User-facing "Plus" maps to the database value 'premium'.

alter table public.profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'premium', 'family'));

alter table public.profiles
  add column if not exists bypass_paywall boolean not null default false;

-- Existing rows default to the free tier automatically via the column default.