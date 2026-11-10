
-- Table for admin-managed whitelist of allowed user emails
CREATE TABLE public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can manage allowed emails
CREATE POLICY "Admins can select allowed_emails"
  ON public.allowed_emails FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert allowed_emails"
  ON public.allowed_emails FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete allowed_emails"
  ON public.allowed_emails FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public function to check if an email is allowed (for signup validation)
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE LOWER(email) = LOWER(_email)
  )
  OR
  EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.user_roles r ON r.user_id = u.id
    WHERE LOWER(u.email) = LOWER(_email) AND r.role = 'admin'
  );
$$;
