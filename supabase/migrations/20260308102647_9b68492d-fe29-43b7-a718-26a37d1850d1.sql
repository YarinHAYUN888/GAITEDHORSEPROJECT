
-- Ground truth label votes table
CREATE TABLE public.gait_label_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL,
  clip_id text,
  label text NOT NULL,
  confidence integer DEFAULT 3,
  alternatives jsonb DEFAULT '[]'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  notes text,
  capture_meta jsonb DEFAULT '{}'::jsonb,
  annotator_id uuid NOT NULL,
  annotator_role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  UNIQUE(analysis_id, annotator_id)
);

-- Ground truth consensus table
CREATE TABLE public.gait_label_consensus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid UNIQUE NOT NULL,
  clip_id text,
  final_label text NOT NULL,
  method text NOT NULL DEFAULT 'weighted_vote',
  agreement numeric,
  label_stats jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gait_label_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gait_label_consensus ENABLE ROW LEVEL SECURITY;

-- Votes: users can insert their own
CREATE POLICY "Users insert own votes" ON public.gait_label_votes
  FOR INSERT TO authenticated
  WITH CHECK (annotator_id = auth.uid());

-- Votes: users can read their own
CREATE POLICY "Users select own votes" ON public.gait_label_votes
  FOR SELECT TO authenticated
  USING (annotator_id = auth.uid());

-- Votes: coaches/admins can read all
CREATE POLICY "Admins select all votes" ON public.gait_label_votes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Consensus: admins can read
CREATE POLICY "Admins select consensus" ON public.gait_label_consensus
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Consensus: admins can insert/update
CREATE POLICY "Admins manage consensus" ON public.gait_label_consensus
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update consensus" ON public.gait_label_consensus
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger for confidence range
CREATE OR REPLACE FUNCTION public.validate_vote_confidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.confidence < 1 OR NEW.confidence > 5 THEN
    RAISE EXCEPTION 'confidence must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_vote_confidence
  BEFORE INSERT OR UPDATE ON public.gait_label_votes
  FOR EACH ROW EXECUTE FUNCTION public.validate_vote_confidence();
