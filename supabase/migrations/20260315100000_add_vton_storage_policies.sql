-- Add missing RLS policies for the vton-user-photos storage bucket.
-- Without these, authenticated users cannot upload their try-on photos and
-- receive a "network request failed" error from the Supabase JS client.

-- Allow authenticated users to upload into their own folder (userId/filename).
CREATE POLICY "Users can upload own VTON photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'vton-user-photos'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own VTON photos.
CREATE POLICY "Users can delete own VTON photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'vton-user-photos'
  AND auth.role() = 'authenticated'
);
