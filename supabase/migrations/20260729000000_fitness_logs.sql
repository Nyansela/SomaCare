-- Fitness Logs table for tracking workouts
CREATE TABLE IF NOT EXISTS public.fitness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_type text,
  duration_minutes integer NOT NULL,
  intensity text CHECK (intensity IS NULL OR intensity IN ('light', 'moderate', 'intense')),
  logged_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.fitness_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fitness logs" ON public.fitness_logs FOR ALL TO AUTHENTICATED
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT ON public.fitness_logs TO AUTHENTICATED;
GRANT ALL ON public.fitness_logs TO SERVICE_ROLE;

-- Index
CREATE INDEX fitness_logs_user ON public.fitness_logs (user_id, logged_date DESC);
