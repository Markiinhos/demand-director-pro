
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client-files public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-files');

CREATE POLICY "client-files users upload own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "client-files users update own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'client-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "client-files users delete own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
