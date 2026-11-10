
-- Create horse_videos table
CREATE TABLE public.horse_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id uuid REFERENCES public.horses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  analysis_id uuid REFERENCES public.gait_analyses(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_size_bytes bigint,
  duration_seconds numeric,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.horse_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own horse_videos" ON public.horse_videos FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own horse_videos" ON public.horse_videos FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own horse_videos" ON public.horse_videos FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Users update own horse_videos" ON public.horse_videos FOR UPDATE USING (user_id = auth.uid());

-- Index for fast lookup by horse
CREATE INDEX idx_horse_videos_horse_id ON public.horse_videos(horse_id);

-- Storage bucket for horse videos
INSERT INTO storage.buckets (id, name, public) VALUES ('horse-videos', 'horse-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users upload own horse videos" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'horse-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own horse videos" ON storage.objects FOR SELECT
USING (bucket_id = 'horse-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own horse videos" ON storage.objects FOR DELETE
USING (bucket_id = 'horse-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Auto-set user_id trigger
CREATE TRIGGER set_horse_video_user_id BEFORE INSERT ON public.horse_videos
FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
