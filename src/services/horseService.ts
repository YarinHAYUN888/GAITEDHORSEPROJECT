import { supabase } from "@/integrations/supabase/client";
import type { HorseOption } from "@/types/horse";

export async function fetchHorses(): Promise<HorseOption[]> {
  const { data } = await supabase
    .from("horses")
    .select("id, name, breed_id, dmrt3_genotype")
    .order("name");
  return (data as HorseOption[]) || [];
}
