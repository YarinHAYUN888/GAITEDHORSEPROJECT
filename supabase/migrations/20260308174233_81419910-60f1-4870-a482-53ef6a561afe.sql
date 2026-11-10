
-- Add share_token column to gait_analyses
ALTER TABLE public.gait_analyses ADD COLUMN IF NOT EXISTS share_token text UNIQUE DEFAULT NULL;

-- Create index for fast lookups by share_token
CREATE INDEX IF NOT EXISTS idx_gait_analyses_share_token ON public.gait_analyses(share_token) WHERE share_token IS NOT NULL;

-- Allow public (anon) SELECT when share_token matches
CREATE POLICY "Public can view shared analyses"
ON public.gait_analyses
FOR SELECT
TO anon
USING (share_token IS NOT NULL);
