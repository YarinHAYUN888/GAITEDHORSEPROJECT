import { supabase } from "@/integrations/supabase/client";
import { systemSelfCheck, type SystemCheckResult } from "@/services/systemService";

export interface IntegrationCheck {
  name: string;
  nameHe: string;
  status: "ok" | "degraded" | "down" | "unknown";
  latencyMs: number;
  details?: string;
  checkedAt: string;
}

export interface AllIntegrationsResult {
  overall: "healthy" | "degraded" | "down";
  checks: IntegrationCheck[];
  timestamp: string;
}

export async function checkDatabase(): Promise<IntegrationCheck> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("horses").select("id").limit(1);
    const latency = Date.now() - start;
    return {
      name: "database",
      nameHe: "מסד נתונים",
      status: error ? "degraded" : latency > 3000 ? "degraded" : "ok",
      latencyMs: latency,
      details: error?.message,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "database",
      nameHe: "מסד נתונים",
      status: "down",
      latencyMs: Date.now() - start,
      details: e instanceof Error ? e.message : "Unknown",
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function checkAIGateway(): Promise<IntegrationCheck> {
  const start = Date.now();
  try {
    // Ping via system-self-check which checks AI internally
    const result = await systemSelfCheck();
    const aiCheck = result.checks.find(c => c.name === "ai_gateway");
    return {
      name: "ai_gateway",
      nameHe: "שירות AI",
      status: aiCheck?.status || "unknown",
      latencyMs: aiCheck?.latencyMs || (Date.now() - start),
      details: aiCheck?.details,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "ai_gateway",
      nameHe: "שירות AI",
      status: "down",
      latencyMs: Date.now() - start,
      details: e instanceof Error ? e.message : "Unknown",
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function checkEdgeFunctions(): Promise<IntegrationCheck> {
  const start = Date.now();
  try {
    const result = await systemSelfCheck();
    const latency = Date.now() - start;
    return {
      name: "edge_functions",
      nameHe: "פונקציות שרת",
      status: result.status === "healthy" ? "ok" : result.status === "degraded" ? "degraded" : "down",
      latencyMs: latency,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      name: "edge_functions",
      nameHe: "פונקציות שרת",
      status: "down",
      latencyMs: Date.now() - start,
      details: e instanceof Error ? e.message : "Unknown",
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function checkAllIntegrations(): Promise<AllIntegrationsResult> {
  const checks = await Promise.all([checkDatabase(), checkAIGateway(), checkEdgeFunctions()]);
  const hasDown = checks.some(c => c.status === "down");
  const hasDegraded = checks.some(c => c.status === "degraded");

  return {
    overall: hasDown ? "down" : hasDegraded ? "degraded" : "healthy",
    checks,
    timestamp: new Date().toISOString(),
  };
}
