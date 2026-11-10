
-- Fix remaining restrictive policies: conformation_records
DROP POLICY IF EXISTS "Users delete own conformation_records" ON public.conformation_records;
DROP POLICY IF EXISTS "Users insert own conformation_records" ON public.conformation_records;
DROP POLICY IF EXISTS "Users select own conformation_records" ON public.conformation_records;
DROP POLICY IF EXISTS "Users update own conformation_records" ON public.conformation_records;
CREATE POLICY "Users delete own conformation_records" ON public.conformation_records FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own conformation_records" ON public.conformation_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users select own conformation_records" ON public.conformation_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own conformation_records" ON public.conformation_records FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- gait_analyses
DROP POLICY IF EXISTS "Users delete own gait_analyses" ON public.gait_analyses;
DROP POLICY IF EXISTS "Users insert own gait_analyses" ON public.gait_analyses;
DROP POLICY IF EXISTS "Users select own gait_analyses" ON public.gait_analyses;
DROP POLICY IF EXISTS "Users update own gait_analyses" ON public.gait_analyses;
DROP POLICY IF EXISTS "Public can view shared analyses by token" ON public.gait_analyses;
CREATE POLICY "Users delete own gait_analyses" ON public.gait_analyses FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own gait_analyses" ON public.gait_analyses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users select own gait_analyses" ON public.gait_analyses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own gait_analyses" ON public.gait_analyses FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Public can view shared analyses by token" ON public.gait_analyses FOR SELECT TO anon, authenticated USING (share_token IS NOT NULL AND share_token = current_setting('request.headers', true)::json->>'x-share-token');

-- gait_label_consensus
DROP POLICY IF EXISTS "Admins manage consensus" ON public.gait_label_consensus;
DROP POLICY IF EXISTS "Admins select consensus" ON public.gait_label_consensus;
DROP POLICY IF EXISTS "Admins update consensus" ON public.gait_label_consensus;
CREATE POLICY "Admins manage consensus" ON public.gait_label_consensus FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins select consensus" ON public.gait_label_consensus FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update consensus" ON public.gait_label_consensus FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- gait_label_votes
DROP POLICY IF EXISTS "Admins select all votes" ON public.gait_label_votes;
DROP POLICY IF EXISTS "Users insert own votes" ON public.gait_label_votes;
DROP POLICY IF EXISTS "Users select own votes" ON public.gait_label_votes;
CREATE POLICY "Admins select all votes" ON public.gait_label_votes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own votes" ON public.gait_label_votes FOR INSERT TO authenticated WITH CHECK (annotator_id = auth.uid());
CREATE POLICY "Users select own votes" ON public.gait_label_votes FOR SELECT TO authenticated USING (annotator_id = auth.uid());

-- gait_validations
DROP POLICY IF EXISTS "Admins select all validations" ON public.gait_validations;
DROP POLICY IF EXISTS "Users insert own validations" ON public.gait_validations;
DROP POLICY IF EXISTS "Users select own validations" ON public.gait_validations;
CREATE POLICY "Admins select all validations" ON public.gait_validations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own validations" ON public.gait_validations FOR INSERT TO authenticated WITH CHECK (validator_id = auth.uid());
CREATE POLICY "Users select own validations" ON public.gait_validations FOR SELECT TO authenticated USING (validator_id = auth.uid());
