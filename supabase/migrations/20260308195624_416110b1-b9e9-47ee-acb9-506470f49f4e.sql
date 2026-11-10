
-- Fix ALL restrictive policies to PERMISSIVE for: admin_audit_log
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit logs" ON public.admin_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can insert audit logs" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- allowed_emails
DROP POLICY IF EXISTS "Admins can delete allowed_emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Admins can insert allowed_emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Admins can select allowed_emails" ON public.allowed_emails;
CREATE POLICY "Admins can delete allowed_emails" ON public.allowed_emails FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert allowed_emails" ON public.allowed_emails FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can select allowed_emails" ON public.allowed_emails FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- analysis_credits
DROP POLICY IF EXISTS "Users insert own credits" ON public.analysis_credits;
DROP POLICY IF EXISTS "Users read own credits" ON public.analysis_credits;
DROP POLICY IF EXISTS "Users update own credits" ON public.analysis_credits;
CREATE POLICY "Users insert own credits" ON public.analysis_credits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own credits" ON public.analysis_credits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own credits" ON public.analysis_credits FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- analysis_feedback  
DROP POLICY IF EXISTS "Admins select all feedback" ON public.analysis_feedback;
DROP POLICY IF EXISTS "Users delete own feedback" ON public.analysis_feedback;
DROP POLICY IF EXISTS "Users insert own feedback" ON public.analysis_feedback;
DROP POLICY IF EXISTS "Users select own feedback" ON public.analysis_feedback;
DROP POLICY IF EXISTS "Users update own feedback" ON public.analysis_feedback;
CREATE POLICY "Admins select all feedback" ON public.analysis_feedback FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users delete own feedback" ON public.analysis_feedback FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own feedback" ON public.analysis_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users select own feedback" ON public.analysis_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own feedback" ON public.analysis_feedback FOR UPDATE TO authenticated USING (user_id = auth.uid());
