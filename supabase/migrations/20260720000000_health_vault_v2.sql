-- Health Vault Extension v2
-- Adds clinically useful fields: smoking, alcohol, diet, goals, allergies table, medical history

-- 1. Add new columns to health_vault
ALTER TABLE public.health_vault 
ADD COLUMN IF NOT EXISTS smoking_status text,
ADD COLUMN IF NOT EXISTS alcohol_use text,
ADD COLUMN IF NOT EXISTS dietary_preference text,
ADD COLUMN IF NOT EXISTS dietary_preference_other text,
ADD COLUMN IF NOT EXISTS health_goals text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_pregnant boolean;

-- 2. Create allergies table
CREATE TABLE IF NOT EXISTS public.allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  allergen text not null,
  reaction text,
  severity text not null check (severity in ('mild', 'moderate', 'severe', 'life_threatening')),
  created_at timestamptz not null default now()
);

-- RLS for allergies
ALTER TABLE public.allergies enable row level security;
CREATE POLICY "own allergies" on public.allergies for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants
GRANT select, insert, update, delete ON public.allergies TO authenticated;
GRANT all ON public.allergies TO service_role;

-- Index
CREATE INDEX allergies_user ON public.allergies (user_id);

-- 3. Create medical_history_events table
CREATE TABLE IF NOT EXISTS public.medical_history_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('surgery', 'immunization', 'family_history')),
  description text not null,
  related_person text,
  event_date date,
  created_at timestamptz not null default now()
);

-- RLS for medical_history_events
ALTER TABLE public.medical_history_events enable row level security;
CREATE POLICY "own medical history" on public.medical_history_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants
GRANT select, insert, update, delete ON public.medical_history_events TO authenticated;
GRANT all ON public.medical_history_events TO service_role;

-- Index
CREATE INDEX medical_history_user ON public.medical_history_events (user_id, event_type);

-- 4. Migration: Copy existing allergies from health_vault to new table
-- This is a best-effort migration - severity will be null
INSERT INTO public.allergies (user_id, allergen, severity, created_at)
SELECT 
  hv.user_id,
  unnest(hv.allergies),
  NULL::text,
  now()
FROM public.health_vault hv
WHERE hv.allergies IS NOT NULL 
  AND array_length(hv.allergies, 1) > 0
ON CONFLICT DO NOTHING;
