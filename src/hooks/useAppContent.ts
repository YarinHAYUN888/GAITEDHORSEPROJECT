import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppContent {
  subtitle_he?: string;
  subtitle_en?: string;
  description_he?: string;
  description_en?: string;
  announcement_he?: string;
  announcement_en?: string;
}
export function useAppContent() {
  return useQuery({ queryKey: ["app-content"], queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "public_content").maybeSingle();
    if (error) throw error;
    return (data?.value ?? {}) as AppContent;
  }, staleTime: 30000 });
}