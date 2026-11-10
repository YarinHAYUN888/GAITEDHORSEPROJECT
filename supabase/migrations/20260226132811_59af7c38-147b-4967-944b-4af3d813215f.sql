
-- Add Foreign Key constraints with ON DELETE CASCADE

-- gait_analyses -> horses
ALTER TABLE public.gait_analyses
  ADD CONSTRAINT fk_gait_horse
  FOREIGN KEY (horse_id) REFERENCES public.horses(id)
  ON DELETE CASCADE;

-- training_logs -> horses  
ALTER TABLE public.training_logs
  ADD CONSTRAINT fk_training_horse
  FOREIGN KEY (horse_id) REFERENCES public.horses(id)
  ON DELETE CASCADE;

-- health_records -> horses
ALTER TABLE public.health_records
  ADD CONSTRAINT fk_health_horse
  FOREIGN KEY (horse_id) REFERENCES public.horses(id)
  ON DELETE CASCADE;

-- conformation_records: drop existing and re-add with CASCADE
ALTER TABLE public.conformation_records
  DROP CONSTRAINT IF EXISTS conformation_records_horse_id_fkey;

ALTER TABLE public.conformation_records
  ADD CONSTRAINT fk_conformation_horse
  FOREIGN KEY (horse_id) REFERENCES public.horses(id)
  ON DELETE CASCADE;
