-- Add storage bucket for extracted outfit assets used by upload and VTON.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('outfit-results', 'outfit-results', true, 10485760, '{image/jpeg,image/png,image/webp}')
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users to remove extracted assets from this bucket when needed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own outfit results'
  ) THEN
    CREATE POLICY "Users can delete own outfit results" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'outfit-results'
      AND auth.role() = 'authenticated'
    );
  END IF;
END
$$;
