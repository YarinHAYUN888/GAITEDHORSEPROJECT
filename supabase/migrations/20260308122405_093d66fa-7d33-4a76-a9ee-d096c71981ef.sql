ALTER TABLE public.gait_analyses ADD COLUMN IF NOT EXISTS video_hash text;
CREATE INDEX IF NOT EXISTS idx_gait_analyses_video_hash ON public.gait_analyses (video_hash) WHERE video_hash IS NOT NULL;