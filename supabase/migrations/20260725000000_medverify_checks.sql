-- MedVerify: Medication safety check logging table
CREATE TABLE IF NOT EXISTS public.medverify_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_name text not null,
  result_summary text,
  created_at timestamptz not null default now()
);

-- RLS
ALTER TABLE public.medverify_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own medverify checks" ON public.medverify_checks FOR ALL TO AUTHENTICATED
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT ON public.medverify_checks TO AUTHENTICATED;
GRANT ALL ON public.medverify_checks TO SERVICE_ROLE;

-- Index
CREATE INDEX medverify_checks_user ON public.medverify_checks (user_id, created_at DESC);
