import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useAdminAccess() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["admin-access", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      return data === true;
    },
  });
  return { isAdmin: Boolean(user && query.data), loading: query.isLoading, error: query.error, retry: query.refetch };
}