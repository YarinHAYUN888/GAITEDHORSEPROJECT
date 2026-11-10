
-- Fix remaining tables: health_records, horses, horse_videos (already fixed but may still be restrictive), model_versions, pipeline_events, profiles, training_logs, user_roles

-- health_records
DROP POLICY IF EXISTS "Users delete own health_records" ON public.health_records;
DROP POLICY IF EXISTS "Users insert own health_records" ON public.health_records;
DROP POLICY IF EXISTS "Users select own health_records" ON public.health_records;
DROP POLICY IF EXISTS "Users update own health_records" ON public.health_records;
CREATE POLICY "Users delete own health_records" ON public.health_records FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own health_records" ON public.health_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users select own health_records" ON public.health_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own health_records" ON public.health_records FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- horses
DROP POLICY IF EXISTS "Users delete own horses" ON public.horses;
DROP POLICY IF EXISTS "Users insert own horses" ON public.horses;
DROP POLICY IF EXISTS "Users select own horses" ON public.horses;
DROP POLICY IF EXISTS "Users update own horses" ON public.horses;
CREATE POLICY "Users delete own horses" ON public.horses FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own horses" ON public.horses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users select own horses" ON public.horses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own horses" ON public.horses FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- horse_videos (recreate as permissive)
DROP POLICY IF EXISTS "Users select own horse_videos" ON public.horse_videos;
DROP POLICY IF EXISTS "Users insert own horse_videos" ON public.horse_videos;
DROP POLICY IF EXISTS "Users update own horse_videos" ON public.horse_videos;
DROP POLICY IF EXISTS "Users delete own horse_videos" ON public.horse_videos;
CREATE POLICY "Users select own horse_videos" ON public.horse_videos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own horse_videos" ON public.horse_videos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own horse_videos" ON public.horse_videos FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own horse_videos" ON public.horse_videos FOR DELETE TO authenticated USING (user_id = auth.uid());

-- model_versions
DROP POLICY IF EXISTS "Admins can insert model_versions" ON public.model_versions;
DROP POLICY IF EXISTS "Admins can update model_versions" ON public.model_versions;
DROP POLICY IF EXISTS "Authenticated users can read model_versions" ON public.model_versions;
CREATE POLICY "Admins can insert model_versions" ON public.model_versions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update model_versions" ON public.model_versions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can read model_versions" ON public.model_versions FOR SELECT TO authenticated USING (true);

-- pipeline_events
DROP POLICY IF EXISTS "Admins select all pipeline events" ON public.pipeline_events;
DROP POLICY IF EXISTS "Users insert own pipeline events" ON public.pipeline_events;
DROP POLICY IF EXISTS "Users select own pipeline events" ON public.pipeline_events;
CREATE POLICY "Admins select all pipeline events" ON public.pipeline_events FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own pipeline events" ON public.pipeline_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users select own pipeline events" ON public.pipeline_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- training_logs
DROP POLICY IF EXISTS "Users delete own training_logs" ON public.training_logs;
DROP POLICY IF EXISTS "Users insert own training_logs" ON public.training_logs;
DROP POLICY IF EXISTS "Users select own training_logs" ON public.training_logs;
DROP POLICY IF EXISTS "Users update own training_logs" ON public.training_logs;
CREATE POLICY "Users delete own training_logs" ON public.training_logs FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own training_logs" ON public.training_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users select own training_logs" ON public.training_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own training_logs" ON public.training_logs FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
