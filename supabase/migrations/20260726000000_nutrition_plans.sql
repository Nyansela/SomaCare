-- Nutrition Plans table for storing AI-generated meal plans
CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  plan_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  medication_reminders jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- RLS
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nutrition plans" ON public.nutrition_plans FOR ALL TO AUTHENTICATED
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT ON public.nutrition_plans TO AUTHENTICATED;
GRANT ALL ON public.nutrition_plans TO SERVICE_ROLE;

-- Index
CREATE INDEX nutrition_plans_user ON public.nutrition_plans (user_id, generated_at DESC);
