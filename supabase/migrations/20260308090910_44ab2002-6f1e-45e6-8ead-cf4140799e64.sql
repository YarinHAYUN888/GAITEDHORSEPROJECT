
CREATE TABLE public.gait_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL,
  validator_id uuid NOT NULL,
  labeled_gait_type text NOT NULL,
  confidence integer,
  comment text,
  label_source text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  UNIQUE(analysis_id, validator_id)
);

ALTER TABLE public.gait_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own validations" ON public.gait_validations FOR INSERT TO authenticated WITH CHECK (validator_id = auth.uid());
CREATE POLICY "Users select own validations" ON public.gait_validations FOR SELECT TO authenticated USING (validator_id = auth.uid());
CREATE POLICY "Admins select all validations" ON public.gait_validations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.validation_consensus AS
SELECT
  analysis_id,
  labeled_gait_type,
  COUNT(*)::integer as vote_count,
  AVG(confidence)::numeric as avg_confidence,
  COUNT(DISTINCT validator_id)::integer as validator_count
FROM public.gait_validations
GROUP BY analysis_id, labeled_gait_type;
