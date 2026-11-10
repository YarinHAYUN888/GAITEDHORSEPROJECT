import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}

export interface SystemCheckResult {
  status: "healthy" | "degraded" | "down";
  checks: Array<{
    name: string;
    status: "ok" | "degraded" | "down";
    latencyMs: number;
    details?: string;
  }>;
  timestamp: string;
}

export async function systemSelfCheck(): Promise<SystemCheckResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/system-self-check`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `שגיאת שרת: ${response.status}`);
  }
  return response.json();
}

export interface ReportResult {
  report: string;
  reportId: string;
  format: string;
  generatedAt: string;
}

export async function sendReport(
  analysisId: string,
  recipientEmail?: string,
  format: "html" | "markdown" = "markdown"
): Promise<ReportResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE}/send-analysis-report`, {
    method: "POST",
    headers,
    body: JSON.stringify({ analysisId, recipientEmail, format }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `שגיאת שרת: ${response.status}`);
  }
  return response.json();
}
