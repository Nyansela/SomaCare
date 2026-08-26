-- Multi-day AI-generated workout & meal plans + agentic action logging

-- ── workout_plans ────────────────────────────────────────────────
create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text not null,
  duration_days integer not null,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;

create policy "own workout plans" on public.workout_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.workout_plans to authenticated;
grant all on public.workout_plans to service_role;

create index if not exists idx_workout_plans_user on public.workout_plans (user_id, status);

-- ── workout_plan_days ────────────────────────────────────────────
create table if not exists public.workout_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_number integer not null,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, day_number)
);

alter table public.workout_plan_days enable row level security;

create policy "own workout plan days" on public.workout_plan_days for all to authenticated
  using (
    exists (
      select 1 from public.workout_plans p
      where p.id = workout_plan_days.plan_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_plans p
      where p.id = workout_plan_days.plan_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.workout_plan_days to authenticated;
grant all on public.workout_plan_days to service_role;

create index if not exists idx_workout_plan_days_plan on public.workout_plan_days (plan_id, day_number);

-- ── meal_plans ───────────────────────────────────────────────────
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text not null,
  duration_days integer not null,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now()
);

alter table public.meal_plans enable row level security;

create policy "own meal plans" on public.meal_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.meal_plans to authenticated;
grant all on public.meal_plans to service_role;

create index if not exists idx_meal_plans_user on public.meal_plans (user_id, status);

-- ── meal_plan_days ───────────────────────────────────────────────
create table if not exists public.meal_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day_number integer not null,
  meals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, day_number)
);

alter table public.meal_plan_days enable row level security;

create policy "own meal plan days" on public.meal_plan_days for all to authenticated
  using (
    exists (
      select 1 from public.meal_plans p
      where p.id = meal_plan_days.plan_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.meal_plans p
      where p.id = meal_plan_days.plan_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.meal_plan_days to authenticated;
grant all on public.meal_plan_days to service_role;

create index if not exists idx_meal_plan_days_plan on public.meal_plan_days (plan_id, day_number);

-- ── plan_day_completions ─────────────────────────────────────────
create table if not exists public.plan_day_completions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  plan_type text not null check (plan_type in ('workout', 'meal')),
  day_number integer not null,
  completed_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (plan_id, day_number)
);

alter table public.plan_day_completions enable row level security;

create policy "own plan day completions" on public.plan_day_completions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.plan_day_completions to authenticated;
grant all on public.plan_day_completions to service_role;

create index if not exists idx_plan_day_completions_plan on public.plan_day_completions (plan_id, day_number);

-- ── medication_dose_logs (taken/not-taken status per day) ────────
create table if not exists public.medication_dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  taken_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (medication_id, taken_on)
);

alter table public.medication_dose_logs enable row level security;

create policy "own medication dose logs" on public.medication_dose_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.medication_dose_logs to authenticated;
grant all on public.medication_dose_logs to service_role;

create index if not exists idx_med_dose_logs_user on public.medication_dose_logs (user_id, taken_on);

-- ── action_logs (agentic write-action audit trail) ───────────────
create table if not exists public.action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  outcome text not null check (outcome in ('proposed', 'confirmed', 'declined', 'executed', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.action_logs enable row level security;

create policy "own action logs" on public.action_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.action_logs to authenticated;
grant all on public.action_logs to service_role;

create index if not exists idx_action_logs_user on public.action_logs (user_id, created_at);
