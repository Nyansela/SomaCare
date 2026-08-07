-- Health Vault Extension
-- Adds comprehensive health profile data beyond what profiles table contains

-- Table: health_vault
create table public.health_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,

  -- Basic Info (extends profiles)
  age integer,
  body_weight_kg numeric,
  gender text,

  -- Location
  country text,
  city text,

  -- Medical History
  past_illnesses text[] default '{}',
  hereditary_diseases text[] default '{}',

  -- Emergency Contact
  emergency_contact_name text,
  emergency_contact_phone text,

  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.health_vault enable row level security;
create policy "own health vault" on public.health_vault for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants
grant select, insert, update, delete on public.health_vault to authenticated;
grant all on public.health_vault to service_role;

-- Trigger for updated_at
create trigger health_vault_touch before update on public.health_vault
  for each row execute function public.tg_touch_updated_at();

-- Auto-create empty health vault on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  insert into public.health_vault (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

-- Index
create index health_vault_user on public.health_vault (user_id);
