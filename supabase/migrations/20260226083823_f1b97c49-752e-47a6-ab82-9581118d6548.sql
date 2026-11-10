
-- Create a public storage bucket for hero videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-videos', 'hero-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read files from the bucket
CREATE POLICY "Public read access for hero videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'hero-videos');

-- Allow anyone to upload (we'll restrict in UI if needed later)
CREATE POLICY "Allow uploads to hero videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hero-videos');

-- Allow anyone to update
CREATE POLICY "Allow updates to hero videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'hero-videos');

-- Allow anyone to delete
CREATE POLICY "Allow deletes from hero videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'hero-videos');
