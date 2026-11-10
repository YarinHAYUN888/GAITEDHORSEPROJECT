DROP TRIGGER IF EXISTS audit_site_media_changes ON storage.objects;
CREATE OR REPLACE FUNCTION public.admin_log_media(_bucket text,_name text,_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF _bucket NOT IN ('hero-videos','hero-music') OR _action NOT IN ('upload','delete') OR length(_name)>512 THEN RAISE EXCEPTION 'Invalid media event'; END IF;
 INSERT INTO public.admin_audit_log(user_id,action,target_type,target_id,metadata) VALUES(auth.uid(),'site_media_' || _action,'media',_name,jsonb_build_object('bucket',_bucket));
END $$;
REVOKE ALL ON FUNCTION public.admin_log_media(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_log_media(text,text,text) TO authenticated;