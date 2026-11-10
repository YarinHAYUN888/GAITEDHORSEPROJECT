
-- 1. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 2. Create user_roles table (per security guidelines)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Add user_id to existing tables
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.gait_analyses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.conformation_records ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.training_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 4. Drop old permissive-all policies and create proper RLS
DROP POLICY IF EXISTS "Allow all access to horses" ON public.horses;
DROP POLICY IF EXISTS "Allow all access to gait_analyses" ON public.gait_analyses;
DROP POLICY IF EXISTS "Allow all access to conformation_records" ON public.conformation_records;
DROP POLICY IF EXISTS "Allow all access to training_logs" ON public.training_logs;
DROP POLICY IF EXISTS "Allow all access to health_records" ON public.health_records;

-- Horses policies
CREATE POLICY "Users select own horses" ON public.horses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own horses" ON public.horses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own horses" ON public.horses FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own horses" ON public.horses FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Gait analyses policies
CREATE POLICY "Users select own gait_analyses" ON public.gait_analyses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own gait_analyses" ON public.gait_analyses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own gait_analyses" ON public.gait_analyses FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own gait_analyses" ON public.gait_analyses FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Conformation records policies
CREATE POLICY "Users select own conformation_records" ON public.conformation_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own conformation_records" ON public.conformation_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own conformation_records" ON public.conformation_records FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own conformation_records" ON public.conformation_records FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Training logs policies
CREATE POLICY "Users select own training_logs" ON public.training_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own training_logs" ON public.training_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own training_logs" ON public.training_logs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own training_logs" ON public.training_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Health records policies
CREATE POLICY "Users select own health_records" ON public.health_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own health_records" ON public.health_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own health_records" ON public.health_records FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own health_records" ON public.health_records FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Trigger to auto-set user_id on insert for each table
CREATE OR REPLACE FUNCTION public.set_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_horses_user_id BEFORE INSERT ON public.horses FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_gait_analyses_user_id BEFORE INSERT ON public.gait_analyses FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_conformation_records_user_id BEFORE INSERT ON public.conformation_records FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_training_logs_user_id BEFORE INSERT ON public.training_logs FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_health_records_user_id BEFORE INSERT ON public.health_records FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
