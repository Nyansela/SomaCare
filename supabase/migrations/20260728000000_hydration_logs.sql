-- Hydration Logs table for tracking water intake
CREATE TABLE IF NOT EXISTS public.hydration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml numeric NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hydration logs" ON public.hydration_logs FOR ALL TO AUTHENTICATED
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT ON public.hydration_logs TO AUTHENTICATED;
GRANT ALL ON public.hydration_logs TO SERVICE_ROLE;

-- Index
CREATE INDEX hydration_logs_user ON public.hydration_logs (user_id, logged_at DESC);
