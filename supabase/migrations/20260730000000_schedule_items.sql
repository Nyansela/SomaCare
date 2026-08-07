-- Schedule Items table for custom to-dos and reminders
CREATE TABLE IF NOT EXISTS public.schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'todo' CHECK (item_type IN ('todo', 'reminder', 'custom')),
  scheduled_at timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schedule items" ON public.schedule_items FOR ALL TO AUTHENTICATED
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_items TO AUTHENTICATED;
GRANT ALL ON public.schedule_items TO SERVICE_ROLE;

-- Index
CREATE INDEX schedule_items_user ON public.schedule_items (user_id, scheduled_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schedule_items_updated_at
  BEFORE UPDATE ON public.schedule_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
