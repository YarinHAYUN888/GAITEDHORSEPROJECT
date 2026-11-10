CREATE TABLE public.conformation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id uuid REFERENCES public.horses(id),
  horse_name text,
  breed_id text,
  dmrt3_genotype text,
  shoulder_angle numeric,
  back_ratio text,
  croup_slope numeric,
  hind_leg_angles text,
  neck_set text,
  overall_balance integer,
  suitability_score integer,
  gait_suitability jsonb DEFAULT '{}'::jsonb,
  strengths text[] DEFAULT '{}'::text[],
  weaknesses text[] DEFAULT '{}'::text[],
  injury_risk_areas text[] DEFAULT '{}'::text[],
  recommendation text,
  result_json jsonb DEFAULT '{}'::jsonb,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conformation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to conformation_records"
  ON public.conformation_records FOR ALL USING (true) WITH CHECK (true);