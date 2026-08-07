-- Sleep Logs table for tracking sleep patterns
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bedtime timestamptz NOT NULL,
  wake_time timestamptz NOT NULL,
  quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
  notes text,
  logged_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sleep logs" ON public.sleep_logs FOR ALL TO AUTHENTICATED
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.sleep_logs TO AUTHENTICATED;
GRANT ALL ON public.sleep_logs TO SERVICE_ROLE;

-- Index
CREATE INDEX sleep_logs_user ON public.sleep_logs (user_id, logged_date DESC);
