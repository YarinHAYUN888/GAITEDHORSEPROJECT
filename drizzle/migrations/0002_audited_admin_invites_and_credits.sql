CREATE OR REPLACE FUNCTION public.admin_manage_invite(_email text, _allow boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE normalized text := lower(trim(_email));
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF length(normalized) > 254 OR normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
 IF _allow THEN
  INSERT INTO public.allowed_emails(email,added_by) SELECT normalized,auth.uid() WHERE NOT EXISTS(SELECT 1 FROM public.allowed_emails WHERE lower(email)=normalized);
 ELSE
  DELETE FROM public.allowed_emails WHERE lower(email)=normalized;
 END IF;
 INSERT INTO public.admin_audit_log(user_id,action,target_type,target_id) VALUES(auth.uid(),CASE WHEN _allow THEN 'allow_registration' ELSE 'remove_invitation' END,'invitation',normalized);
END $$;
REVOKE ALL ON FUNCTION public.admin_manage_invite(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_invite(text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_set_credits(_target uuid,_tier text,_remaining integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 total := CASE _tier WHEN 'free' THEN 20 WHEN 'pro' THEN 100 WHEN 'coach' THEN 999 ELSE NULL END;
 IF total IS NULL OR _remaining < 0 OR _remaining > total THEN RAISE EXCEPTION 'Invalid credits'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_target) THEN RAISE EXCEPTION 'Unknown user'; END IF;
 INSERT INTO public.analysis_credits(user_id,tier,credits_remaining,credits_total,reset_at,updated_at) VALUES(_target,_tier,_remaining,total,now()+interval '30 days',now()) ON CONFLICT(user_id) DO UPDATE SET tier=EXCLUDED.tier,credits_remaining=EXCLUDED.credits_remaining,credits_total=EXCLUDED.credits_total,reset_at=EXCLUDED.reset_at,updated_at=now();
 INSERT INTO public.admin_audit_log(user_id,action,target_type,target_id,metadata) VALUES(auth.uid(),'set_credits','user',_target::text,jsonb_build_object('tier',_tier,'remaining',_remaining));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_credits(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_credits(uuid,text,integer) TO authenticated;