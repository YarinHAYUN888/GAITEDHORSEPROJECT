CREATE TABLE public.mare_pregnancies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 horse_id uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL DEFAULT auth.uid(),
 breeding_date date NOT NULL,
 date_basis text NOT NULL DEFAULT 'breeding' CHECK (date_basis IN ('breeding','ovulation')),
 expected_foaling_date date,
 status text NOT NULL DEFAULT 'suspected' CHECK (status IN ('suspected','confirmed','foaled','lost')),
 veterinarian text NOT NULL DEFAULT '',
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mare_pregnancies TO authenticated;
GRANT ALL ON public.mare_pregnancies TO service_role;
ALTER TABLE public.mare_pregnancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY pregnancy_owner ON public.mare_pregnancies FOR ALL TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.horses h WHERE h.id = horse_id AND h.user_id = auth.uid())) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.horses h WHERE h.id = horse_id AND h.user_id = auth.uid() AND h.sex = 'mare'));
CREATE UNIQUE INDEX one_active_pregnancy_per_mare ON public.mare_pregnancies(horse_id) WHERE status IN ('suspected','confirmed');
CREATE TABLE public.pregnancy_examinations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pregnancy_id uuid NOT NULL REFERENCES public.mare_pregnancies(id) ON DELETE CASCADE,
 user_id uuid NOT NULL DEFAULT auth.uid(),
 examination_date date NOT NULL,
 examination_type text NOT NULL CHECK (examination_type IN ('ultrasound','vaccination','checkup','other')),
 findings text NOT NULL DEFAULT '',
 veterinarian text NOT NULL DEFAULT '',
 next_check_date date,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pregnancy_examinations TO authenticated;
GRANT ALL ON public.pregnancy_examinations TO service_role;
ALTER TABLE public.pregnancy_examinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_owner ON public.pregnancy_examinations FOR ALL TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.mare_pregnancies p WHERE p.id = pregnancy_id AND p.user_id = auth.uid())) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.mare_pregnancies p WHERE p.id = pregnancy_id AND p.user_id = auth.uid()));
CREATE INDEX pregnancy_exams_by_parent ON public.pregnancy_examinations(pregnancy_id, examination_date DESC);
CREATE OR REPLACE FUNCTION public.validate_pregnancy_dates() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_TABLE_NAME = 'mare_pregnancies' THEN
  IF NEW.breeding_date > CURRENT_DATE THEN RAISE EXCEPTION 'Pregnancy start date cannot be in the future'; END IF;
  IF NEW.expected_foaling_date IS NOT NULL AND NEW.expected_foaling_date <= NEW.breeding_date THEN RAISE EXCEPTION 'Expected foaling must follow pregnancy start'; END IF;
 ELSE
  IF NEW.examination_date > CURRENT_DATE THEN RAISE EXCEPTION 'Completed examination cannot be in the future'; END IF;
  IF NEW.examination_date < (SELECT breeding_date FROM public.mare_pregnancies WHERE id = NEW.pregnancy_id) THEN RAISE EXCEPTION 'Examination cannot precede pregnancy start'; END IF;
  IF NEW.next_check_date IS NOT NULL AND NEW.next_check_date < NEW.examination_date THEN RAISE EXCEPTION 'Next check cannot precede examination'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_mare_pregnancy_dates BEFORE INSERT OR UPDATE ON public.mare_pregnancies FOR EACH ROW EXECUTE FUNCTION public.validate_pregnancy_dates();
CREATE TRIGGER validate_mare_examination_dates BEFORE INSERT OR UPDATE ON public.pregnancy_examinations FOR EACH ROW EXECUTE FUNCTION public.validate_pregnancy_dates();