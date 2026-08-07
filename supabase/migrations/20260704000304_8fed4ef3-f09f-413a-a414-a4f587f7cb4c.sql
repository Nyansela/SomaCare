
-- Roles
create type public.app_role as enum ('user', 'doctor', 'admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Shared updated_at trigger
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  date_of_birth date,
  sex text,
  blood_type text,
  height_cm numeric,
  allergies text[] default '{}',
  chronic_conditions text[] default '{}',
  emergency_contacts jsonb default '[]'::jsonb,
  locale text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create trigger profiles_touch before update on public.profiles for each row execute function public.tg_touch_updated_at();

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vitals
create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- bp_sys, bp_dia, heart_rate, spo2, glucose, weight, temperature
  value numeric not null,
  unit text,
  taken_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index vitals_user_kind_time on public.vitals (user_id, kind, taken_at desc);
grant select, insert, update, delete on public.vitals to authenticated;
grant all on public.vitals to service_role;
alter table public.vitals enable row level security;
create policy "own vitals" on public.vitals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Medications
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dose text,
  frequency text, -- e.g. "2x per day", human readable
  color text default 'primary',
  notes text,
  start_date date default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index medications_user on public.medications (user_id, active);
grant select, insert, update, delete on public.medications to authenticated;
grant all on public.medications to service_role;
alter table public.medications enable row level security;
create policy "own meds" on public.medications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger medications_touch before update on public.medications for each row execute function public.tg_touch_updated_at();

-- Appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  specialty text,
  provider_avatar_url text,
  starts_at timestamptz not null,
  duration_minutes integer default 30,
  mode text not null default 'in_person', -- in_person | tele
  location text,
  meeting_url text,
  status text not null default 'scheduled', -- scheduled | confirmed | cancelled | completed
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_user_time on public.appointments (user_id, starts_at);
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "own appts" on public.appointments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger appointments_touch before update on public.appointments for each row execute function public.tg_touch_updated_at();

-- AI threads
create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_threads_user on public.ai_threads (user_id, updated_at desc);
grant select, insert, update, delete on public.ai_threads to authenticated;
grant all on public.ai_threads to service_role;
alter table public.ai_threads enable row level security;
create policy "own threads" on public.ai_threads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger ai_threads_touch before update on public.ai_threads for each row execute function public.tg_touch_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null, -- user | assistant | system
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index ai_messages_thread on public.ai_messages (thread_id, created_at);
grant select, insert, update, delete on public.ai_messages to authenticated;
grant all on public.ai_messages to service_role;
alter table public.ai_messages enable row level security;
create policy "own messages" on public.ai_messages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- appointment | medication | ai | order | system
  title text not null,
  body text,
  severity text default 'info', -- info | success | warning | danger
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_time on public.notifications (user_id, created_at desc);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
