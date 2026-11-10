import { useState, useEffect } from "react";
import type { HorseOption } from "@/types/horse";
import { fetchHorses } from "@/services/horseService";

export function useHorses() {
  const [horses, setHorses] = useState<HorseOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHorses()
      .then(setHorses)
      .finally(() => setLoading(false));
  }, []);

  return { horses, loading };
}
