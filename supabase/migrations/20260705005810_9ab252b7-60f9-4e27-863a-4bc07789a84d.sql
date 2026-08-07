
CREATE TABLE public.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  category text,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.records TO authenticated;
GRANT ALL ON public.records TO service_role;

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own records" ON public.records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER records_touch_updated_at
  BEFORE UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Storage policies: files live under records/<user_id>/...
CREATE POLICY "Users read their own record files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'records' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload their own record files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'records' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update their own record files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'records' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete their own record files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'records' AND auth.uid()::text = (storage.foldername(name))[1]);
