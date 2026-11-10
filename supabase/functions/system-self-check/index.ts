import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface CheckResult {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  details?: string;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Service unavailable");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("horses").select("id").limit(1);
    const latency = Date.now() - start;
    if (error) return { name: "database", status: "degraded", latencyMs: latency, details: error.message };
    return { name: "database", status: latency > 3000 ? "degraded" : "ok", latencyMs: latency };
  } catch (e) {
    return { name: "database", status: "down", latencyMs: Date.now() - start, details: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkAIGateway(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return { name: "ai_gateway", status: "down", latencyMs: 0, details: "LOVABLE_API_KEY not configured" };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    await response.text(); // consume body
    if (!response.ok) {
      return { name: "ai_gateway", status: response.status === 429 ? "degraded" : "down", latencyMs: latency, details: `HTTP ${response.status}` };
    }
    return { name: "ai_gateway", status: latency > 5000 ? "degraded" : "ok", latencyMs: latency };
  } catch (e) {
    return { name: "ai_gateway", status: "down", latencyMs: Date.now() - start, details: e instanceof Error ? e.message : "Unknown" };
  }
}

function checkSecrets(): CheckResult {
  const start = Date.now();
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "LOVABLE_API_KEY"];
  const missing = required.filter(s => !Deno.env.get(s));
  return {
    name: "secrets",
    status: missing.length === 0 ? "ok" : missing.length < required.length ? "degraded" : "down",
    latencyMs: Date.now() - start,
    details: missing.length > 0 ? `חסרים: ${missing.join(", ")}` : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !key) throw new Error("Service unavailable");
    const client = createClient(url, key, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: auth, error } = await client.auth.getUser();
    if (error || !auth.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: admin } = await client.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    if (!admin) return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const [dbCheck, aiCheck] = await Promise.all([checkDatabase(), checkAIGateway()]);
    const secretsCheck = checkSecrets();
    const checks = [dbCheck, aiCheck, secretsCheck];

    const hasDown = checks.some(c => c.status === "down");
    const hasDegraded = checks.some(c => c.status === "degraded");
    const overallStatus = hasDown ? "down" : hasDegraded ? "degraded" : "healthy";

    return new Response(JSON.stringify({
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("system-self-check error:", e);
    return new Response(JSON.stringify({ status: "down", error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
