ALTER TABLE public.analysis_feedback ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.analysis_feedback ADD COLUMN IF NOT EXISTS evidence jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.analysis_feedback ADD COLUMN IF NOT EXISTS label_source text DEFAULT 'user';