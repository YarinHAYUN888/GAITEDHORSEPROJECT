CREATE OR REPLACE FUNCTION public.audit_site_media_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); bucket text; object_name text;
BEGIN
 IF TG_OP = 'DELETE' THEN bucket := OLD.bucket_id; object_name := OLD.name; ELSE bucket := NEW.bucket_id; object_name := NEW.name; END IF;
 IF bucket IN ('hero-videos','hero-music') AND actor IS NOT NULL THEN
  INSERT INTO public.admin_audit_log(user_id,action,target_type,target_id,metadata) VALUES(actor,'site_media_' || lower(TG_OP),'media',object_name,jsonb_build_object('bucket',bucket));
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER audit_site_media_changes AFTER INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.audit_site_media_mutation();
CREATE OR REPLACE FUNCTION public.admin_save_setting(_key text,_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF _key <> 'public_content' OR jsonb_typeof(_value) <> 'object' OR octet_length(_value::text) > 12000 THEN RAISE EXCEPTION 'Invalid setting'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(_value) AS entry WHERE entry.key NOT IN ('subtitle_he','subtitle_en','description_he','description_en','announcement_he','announcement_en') OR jsonb_typeof(entry.value) <> 'string' OR length(entry.value #>> '{}') > 1000) THEN RAISE EXCEPTION 'Invalid content field'; END IF;
 INSERT INTO public.app_settings(key,value,updated_by) VALUES(_key,_value,auth.uid()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by=auth.uid();
 INSERT INTO public.admin_audit_log(user_id,action,target_type,target_id) VALUES(auth.uid(),'save_content','app_settings',_key);
END $$;