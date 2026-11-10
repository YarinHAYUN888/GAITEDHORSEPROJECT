
-- 3. Fix horse_videos policies: change from public to authenticated role
DROP POLICY IF EXISTS "Users select own horse_videos" ON public.horse_videos;
DROP POLICY IF EXISTS "Users insert own horse_videos" ON public.horse_videos;
DROP POLICY IF EXISTS "Users update own horse_videos" ON public.horse_videos;
DROP POLICY IF EXISTS "Users delete own horse_videos" ON public.horse_videos;

CREATE POLICY "Users select own horse_videos" ON public.horse_videos
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users insert own horse_videos" ON public.horse_videos
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own horse_videos" ON public.horse_videos
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users delete own horse_videos" ON public.horse_videos
FOR DELETE TO authenticated USING (user_id = auth.uid());
