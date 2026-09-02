-- Create avatars storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (idempotent)
DROP POLICY IF EXISTS "Public Access avatars" ON storage.objects;
DROP POLICY IF EXISTS "Insert Access avatars" ON storage.objects;
DROP POLICY IF EXISTS "Update Access avatars" ON storage.objects;
DROP POLICY IF EXISTS "Delete Access avatars" ON storage.objects;

-- Anyone can read avatar images (public bucket)
CREATE POLICY "Public Access avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder (<user_id>/avatar.*)
CREATE POLICY "Insert Access avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated users can update their own avatar
CREATE POLICY "Update Access avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated users can delete their own avatar
CREATE POLICY "Delete Access avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
