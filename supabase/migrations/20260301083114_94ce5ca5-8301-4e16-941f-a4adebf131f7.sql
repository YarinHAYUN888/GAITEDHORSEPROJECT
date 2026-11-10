
-- 1. Create analysis_feedback table
CREATE TABLE public.analysis_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL,
  user_id uuid NOT NULL,
  feedback_type text NOT NULL,
  corrected_gait_type text,
  keypoint_corrections jsonb,
  rating integer,
  comment text,
  is_expert boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_feedback_analysis FOREIGN KEY (analysis_id) REFERENCES public.gait_analyses(id) ON DELETE CASCADE,
  CONSTRAINT chk_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  CONSTRAINT chk_feedback_type CHECK (feedback_type IN ('gait_correction', 'keypoint_correction', 'recommendation_rating', 'general'))
);

ALTER TABLE public.analysis_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own feedback" ON public.analysis_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own feedback" ON public.analysis_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own feedback" ON public.analysis_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own feedback" ON public.analysis_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins select all feedback" ON public.analysis_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Create model_versions table
CREATE TABLE public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  task text NOT NULL,
  model_name text NOT NULL,
  description text,
  is_active boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read model_versions" ON public.model_versions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert model_versions" ON public.model_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update model_versions" ON public.model_versions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Add columns to gait_analyses
ALTER TABLE public.gait_analyses
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS human_validated boolean DEFAULT false;

-- 4. Auto-set user_id trigger for analysis_feedback
CREATE TRIGGER set_feedback_user_id
  BEFORE INSERT ON public.analysis_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();

-- 5. Seed initial model versions
INSERT INTO public.model_versions (version, task, model_name, description, is_active) VALUES
  ('2.0.0', 'vision', 'google/gemini-2.5-pro', 'מודל ראייה ראשי לזיהוי נקודות שלד', true),
  ('2.0.0', 'text', 'google/gemini-3-flash-preview', 'מודל טקסט לניתוח וסיכום', true),
  ('2.0.0', 'audio', 'google/gemini-3-flash-preview', 'מודל אודיו לניתוח צלילי פרסות', true),
  ('2.0.0', 'conditions', 'google/gemini-3-flash-preview', 'מודל לזיהוי מצבים רפואיים', true);
