
-- Create server-side function for credit management
CREATE OR REPLACE FUNCTION public.init_user_credits(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.analysis_credits (user_id, credits_remaining, credits_total, tier)
  VALUES (_user_id, 20, 20, 'free')
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_credit(_user_id uuid, _amount integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.analysis_credits
  SET credits_remaining = credits_remaining - _amount, updated_at = now()
  WHERE user_id = _user_id AND credits_remaining >= _amount;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.init_user_credits(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid, integer) FROM public, anon;
