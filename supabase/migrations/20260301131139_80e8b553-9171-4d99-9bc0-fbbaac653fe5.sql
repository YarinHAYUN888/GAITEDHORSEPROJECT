-- Create hero-music bucket for background music files
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-music', 'hero-music', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read music files
CREATE POLICY "Public read hero-music" ON storage.objects
  FOR SELECT USING (bucket_id = 'hero-music');

-- Allow authenticated users to upload music
CREATE POLICY "Auth upload hero-music" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'hero-music' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete music
CREATE POLICY "Auth delete hero-music" ON storage.objects
  FOR DELETE USING (bucket_id = 'hero-music' AND auth.role() = 'authenticated');