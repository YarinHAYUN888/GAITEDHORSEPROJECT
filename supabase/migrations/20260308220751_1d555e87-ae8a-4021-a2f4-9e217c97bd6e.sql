
-- Load test runs table
CREATE TABLE public.load_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  config jsonb NOT NULL DEFAULT '{}',
  summary jsonb DEFAULT '{}',
  user_id uuid NOT NULL
);
ALTER TABLE public.load_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select load_test_runs" ON public.load_test_runs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert load_test_runs" ON public.load_test_runs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update load_test_runs" ON public.load_test_runs FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete load_test_runs" ON public.load_test_runs FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Load test results table
CREATE TABLE public.load_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.load_test_runs(id) ON DELETE CASCADE,
  scenario text NOT NULL,
  status_code integer,
  latency_ms integer,
  success boolean DEFAULT false,
  credit_charged boolean DEFAULT false,
  truncated boolean DEFAULT false,
  error_message text,
  correlation_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.load_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select load_test_results" ON public.load_test_results FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert load_test_results" ON public.load_test_results FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
