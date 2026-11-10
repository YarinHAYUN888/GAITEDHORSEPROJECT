
-- Fix credit escalation: remove client INSERT/UPDATE, keep only SELECT
DROP POLICY IF EXISTS "Users insert own credits" ON public.analysis_credits;
DROP POLICY IF EXISTS "Users update own credits" ON public.analysis_credits;

-- Fix has_role enumeration: revoke public execute
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
