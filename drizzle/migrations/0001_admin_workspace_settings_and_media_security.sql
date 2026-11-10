CREATE TABLE public.app_settings (
 key text PRIMARY KEY,
 value jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read published app settings" ON public.app_settings FOR SELECT TO authenticated USING (key = 'public_content' OR public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
DROP POLICY IF EXISTS "Allow uploads to hero videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to hero videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes from hero videos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload hero-music" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete hero-music" ON storage.objects;
CREATE POLICY "Admins upload site media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('hero-videos','hero-music') AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update site media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('hero-videos','hero-music') AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id IN ('hero-videos','hero-music') AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete site media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('hero-videos','hero-music') AND public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.admin_set_role(_target uuid, _admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 PERFORM pg_advisory_xact_lock(719346);
 IF _target = auth.uid() AND NOT _admin THEN RAISE EXCEPTION 'Cannot revoke own administrator access'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target) THEN RAISE EXCEPTION 'Unknown user'; END IF;
 IF _admin THEN
  INSERT INTO public.user_roles(user_id,role) VALUES (_target,'admin') ON CONFLICT(user_id,role) DO NOTHING;
 ELSE
  IF (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role='admin') <= 1 AND public.has_role(_target,'admin') THEN RAISE EXCEPTION 'Cannot remove last admin'; END IF;
  DELETE FROM public.user_roles WHERE user_id=_target AND role='admin';
 END IF;
 INSERT INTO public.admin_audit_log(user_id,action,target_type,target_id,metadata) VALUES(auth.uid(),'set_admin','user',_target::text,jsonb_build_object('admin',_admin));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_save_setting(_key text,_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF _key <> 'public_content' OR jsonb_typeof(_value) <> 'object' OR octet_length(_value::text) > 12000 THEN RAISE EXCEPTION 'Invalid setting'; END IF;
 INSERT INTO public.app_settings(key,value,updated_by) VALUES(_key,_value,auth.uid()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by=auth.uid();
 INSERT INTO public.admin_audit_log(user_id,action,target_type,target_id) VALUES(auth.uid(),'save_content','app_settings',_key);
END $$;
REVOKE ALL ON FUNCTION public.admin_save_setting(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_setting(text,jsonb) TO authenticated;