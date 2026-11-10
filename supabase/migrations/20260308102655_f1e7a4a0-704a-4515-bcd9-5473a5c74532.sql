
CREATE OR REPLACE FUNCTION public.validate_vote_confidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.confidence < 1 OR NEW.confidence > 5 THEN
    RAISE EXCEPTION 'confidence must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;
