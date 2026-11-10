-- Allow admins to select all credits
CREATE POLICY "Admins select all credits"
ON public.analysis_credits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update credits (for renewal)
CREATE POLICY "Admins update all credits"
ON public.analysis_credits
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Grant execute on has_role to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;