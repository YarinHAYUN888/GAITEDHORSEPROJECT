
ALTER TABLE public.gait_analyses 
ADD COLUMN IF NOT EXISTS snapshot_urls text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS enriched_data jsonb DEFAULT NULL;

COMMENT ON COLUMN public.gait_analyses.snapshot_urls IS 'URLs of key frame thumbnails from the analysis';
COMMENT ON COLUMN public.gait_analyses.enriched_data IS 'Full enriched analysis data including biomech, decision trace, explainability';
