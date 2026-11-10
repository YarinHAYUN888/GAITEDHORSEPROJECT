
DROP VIEW IF EXISTS public.validation_consensus;

CREATE VIEW public.validation_consensus
WITH (security_invoker = true) AS
SELECT
  analysis_id,
  labeled_gait_type,
  COUNT(*)::integer as vote_count,
  AVG(confidence)::numeric as avg_confidence,
  COUNT(DISTINCT validator_id)::integer as validator_count
FROM public.gait_validations
GROUP BY analysis_id, labeled_gait_type;
