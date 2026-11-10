
-- 2. Add RLS to validation_consensus view - it's a VIEW, so we need to secure the underlying tables
-- The view uses security_invoker by default in newer PG, but let's ensure it
-- Since validation_consensus is a VIEW, we can't add RLS directly. Instead restrict via the base table policies already in place.
-- Let's check if RLS is enabled on the view - views don't have RLS. We need to recreate it with security_invoker.
DROP VIEW IF EXISTS public.validation_consensus;
CREATE VIEW public.validation_consensus
WITH (security_invoker = on)
AS
SELECT 
  analysis_id,
  labeled_gait_type,
  COUNT(DISTINCT validator_id) as validator_count,
  COUNT(*) as vote_count,
  AVG(confidence) as avg_confidence
FROM public.gait_validations
GROUP BY analysis_id, labeled_gait_type;
