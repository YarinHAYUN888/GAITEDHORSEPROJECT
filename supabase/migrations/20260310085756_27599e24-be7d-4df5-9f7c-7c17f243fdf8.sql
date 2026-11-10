
DROP VIEW IF EXISTS public.validation_consensus;

CREATE VIEW public.validation_consensus
WITH (security_invoker = true)
AS
SELECT
  analysis_id,
  labeled_gait_type,
  count(DISTINCT validator_id) AS validator_count,
  count(*) AS vote_count,
  avg(confidence) AS avg_confidence
FROM gait_validations
GROUP BY analysis_id, labeled_gait_type;
