
CREATE TABLE public.pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid,
  user_id uuid,
  stage text NOT NULL,
  status text NOT NULL,
  duration_ms integer,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own pipeline events"
  ON public.pipeline_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own pipeline events"
  ON public.pipeline_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins select all pipeline events"
  ON public.pipeline_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.analysis_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  credits_remaining integer NOT NULL DEFAULT 20,
  credits_total integer NOT NULL DEFAULT 20,
  tier text NOT NULL DEFAULT 'free',
  reset_at timestamptz DEFAULT (now() + interval '30 days'),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.analysis_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credits"
  ON public.analysis_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own credits"
  ON public.analysis_credits FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own credits"
  ON public.analysis_credits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
