// Edge Function client — shared auth + fetch logic for all edge function calls

import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}

export async function callEdgeFunction<T>(
  name: string,
  body: Record<string, unknown> | object,
  signal?: AbortSignal,
): Promise<T> {
  const headers = await getAuthHeaders();
  // Combine caller signal with internal 60s safety timeout so requests never hang forever.
  const internal = new AbortController();
  const onAbort = () => internal.abort();
  if (signal) {
    if (signal.aborted) internal.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const safety = setTimeout(() => internal.abort(), 60_000);
  try {
    const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: internal.signal,
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `שגיאת שרת: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(safety);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
