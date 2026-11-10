// Resilient edge function caller with retry + model fallback
import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 3000;

export interface CallOptions {
  /** If true, won't retry on failure — just throw immediately */
  critical?: boolean;
  /** Optional label for logging */
  label?: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

interface AttemptLog {
  attempt: number;
  status: number | "network_error";
  latencyMs: number;
  error?: string;
}

export class PaymentRequiredError extends Error {
  constructor() {
    super("נגמרו הקרדיטים — יש להוסיף קרדיטים בהגדרות");
    this.name = "PaymentRequiredError";
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("יותר מדי בקשות — נסה שוב בעוד דקה");
    this.name = "RateLimitError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resilientEdgeCall<T>(
  name: string,
  body: Record<string, unknown> | object,
  options: CallOptions = {}
): Promise<T> {
  const label = options.label || name;
  const logs: AttemptLog[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = performance.now();
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: options.signal,
      });

      const latencyMs = Math.round(performance.now() - start);
      logs.push({ attempt, status: response.status, latencyMs });

      if (response.ok) {
        const data = await response.json();
        if (logs.length > 1) {
          console.info(`[resilient] ${label} succeeded on attempt ${attempt}`, logs);
        }
        return data as T;
      }

      // 402 — payment required, don't retry
      if (response.status === 402) {
        throw new PaymentRequiredError();
      }

      // 429 — rate limited, wait longer then retry
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          console.warn(`[resilient] ${label} rate limited, waiting ${RATE_LIMIT_DELAY_MS}ms...`);
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }
        throw new RateLimitError();
      }

      // 500/502/503/504 — server error, retry with delay
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const errText = await response.text().catch(() => "");
        logs[logs.length - 1].error = errText.slice(0, 200);
        console.warn(`[resilient] ${label} server error ${response.status}, retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      // Other errors — parse and throw
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `שגיאת שרת: ${response.status}`);
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      
      if (err instanceof PaymentRequiredError || err instanceof RateLimitError) {
        throw err;
      }

      logs.push({ attempt, status: "network_error", latencyMs, error: (err as Error).message });

      if (attempt < MAX_RETRIES) {
        console.warn(`[resilient] ${label} failed, retrying...`, (err as Error).message);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      console.error(`[resilient] ${label} failed after ${MAX_RETRIES} attempts`, logs);
      throw err;
    }
  }

  // Should not reach here
  throw new Error(`${label}: exhausted retries`);
}
