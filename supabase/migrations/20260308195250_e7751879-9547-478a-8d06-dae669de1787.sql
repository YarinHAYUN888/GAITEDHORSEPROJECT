
-- 1. Fix shared analyses: drop overly permissive policy, create a proper one
-- that requires the caller to pass the token via a Supabase header
DROP POLICY IF EXISTS "Public can view shared analyses" ON public.gait_analyses;

CREATE POLICY "Public can view shared analyses by token"
ON public.gait_analyses
FOR SELECT
TO anon, authenticated
USING (
  share_token IS NOT NULL 
  AND share_token = current_setting('request.headers', true)::json->>'x-share-token'
);
