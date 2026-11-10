
-- Horses table
CREATE TABLE public.horses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  breed_id TEXT,
  dmrt3_genotype TEXT CHECK (dmrt3_genotype IN ('AA', 'CA', 'CC')),
  height_cm INTEGER,
  birth_year INTEGER,
  sex TEXT CHECK (sex IN ('stallion', 'mare', 'gelding')),
  sire_name TEXT,
  dam_name TEXT,
  sire_dmrt3 TEXT CHECK (sire_dmrt3 IN ('AA', 'CA', 'CC')),
  dam_dmrt3 TEXT CHECK (dam_dmrt3 IN ('AA', 'CA', 'CC')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gait analyses table
CREATE TABLE public.gait_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  horse_id UUID REFERENCES public.horses(id) ON DELETE CASCADE,
  horse_name TEXT,
  breed_id TEXT,
  dmrt3_genotype TEXT,
  gait_type TEXT,
  gait_type_hebrew TEXT,
  overall_score INTEGER,
  confidence INTEGER,
  lateral_sync_pct INTEGER,
  symmetry_score INTEGER,
  lameness_risk TEXT,
  beat_pattern TEXT,
  is_dirty BOOLEAN DEFAULT false,
  result_json JSONB NOT NULL,
  audio_bpm NUMERIC,
  audio_regularity NUMERIC,
  audio_gait_classification TEXT,
  vision_audio_conflict BOOLEAN DEFAULT false,
  conflict_description TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Training logs table
CREATE TABLE public.training_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  horse_id UUID REFERENCES public.horses(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.gait_analyses(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'general',
  duration_minutes INTEGER,
  description TEXT,
  ai_recommendations TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Health records table
CREATE TABLE public.health_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  horse_id UUID REFERENCES public.horses(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('vaccination', 'farrier', 'vet_check', 'treatment', 'injury', 'other')),
  description TEXT NOT NULL,
  provider TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS but allow public access (no auth yet)
ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gait_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (will restrict after auth is added)
CREATE POLICY "Allow all access to horses" ON public.horses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to gait_analyses" ON public.gait_analyses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to training_logs" ON public.training_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to health_records" ON public.health_records FOR ALL USING (true) WITH CHECK (true);
