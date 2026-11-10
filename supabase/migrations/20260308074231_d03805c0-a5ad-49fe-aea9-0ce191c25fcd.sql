
-- Add photo_url column to horses table
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS photo_url text;

-- Create horse-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('horse-photos', 'horse-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Users upload own horse photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'horse-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: anyone can view horse photos (public bucket)
CREATE POLICY "Public read horse photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'horse-photos');

-- RLS: users can delete their own horse photos
CREATE POLICY "Users delete own horse photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'horse-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can update their own horse photos
CREATE POLICY "Users update own horse photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'horse-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
