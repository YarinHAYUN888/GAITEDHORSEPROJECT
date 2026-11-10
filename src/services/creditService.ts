// Credit Service — complexity-aware analysis rate limiting

import { supabase } from "@/integrations/supabase/client";
import type { UserCredits, CreditTier } from "@/types/pipeline";
import { ANALYSIS_COSTS } from "@/types/pipeline";

const DEFAULT_CREDITS: Record<CreditTier, number> = {
  free: 20,
  pro: 100,
  coach: 999,
};

/**
 * Get current credits for user. Auto-creates row if missing.
 */
export async function getCredits(userId: string): Promise<UserCredits> {
  const { data, error } = await supabase
    .from("analysis_credits" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[Credits] Error fetching credits:", error.message);
    // Fallback — allow usage
    return { remaining: 20, total: 20, tier: "free", resetAt: "" };
  }

  if (!data) {
    // Auto-create default credits row
    const tier: CreditTier = "free";
    const total = DEFAULT_CREDITS[tier];
    const { error: insertErr } = await supabase
      .from("analysis_credits" as any)
      .insert({
        user_id: userId,
        credits_remaining: total,
        credits_total: total,
        tier,
      } as any);

    if (insertErr) {
      console.warn("[Credits] Error creating credits:", insertErr.message);
    }

    return { remaining: total, total, tier, resetAt: "" };
  }

  const row = data as any;

  // Auto-reset if past reset date
  if (row.reset_at && new Date(row.reset_at) < new Date()) {
    const total = DEFAULT_CREDITS[(row.tier as CreditTier) || "free"];
    await supabase
      .from("analysis_credits" as any)
      .update({
        credits_remaining: total,
        credits_total: total,
        reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("user_id", userId);

    return { remaining: total, total, tier: row.tier, resetAt: "" };
  }

  return {
    remaining: row.credits_remaining,
    total: row.credits_total,
    tier: row.tier as CreditTier,
    resetAt: row.reset_at ?? "",
  };
}

/**
 * Calculate analysis cost based on mode.
 */
export function calculateCost(mode: string): number {
  return ANALYSIS_COSTS[mode] ?? 5;
}

/**
 * Consume credits after successful analysis. Returns false if insufficient.
 */
export async function consumeCredits(userId: string, cost: number): Promise<boolean> {
  const credits = await getCredits(userId);
  if (credits.remaining < cost) return false;

  const { error } = await supabase
    .from("analysis_credits" as any)
    .update({
      credits_remaining: credits.remaining - cost,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("user_id", userId);

  if (error) {
    console.warn("[Credits] Error consuming credits:", error.message);
    return false;
  }

  return true;
}

/**
 * Check if user has enough credits. Returns degraded=true if not enough for full.
 */
export async function checkCredits(userId: string, mode: string): Promise<{
  allowed: boolean;
  degraded: boolean;
  cost: number;
  remaining: number;
}> {
  const credits = await getCredits(userId);
  const cost = calculateCost(mode);

  if (credits.remaining >= cost) {
    return { allowed: true, degraded: false, cost, remaining: credits.remaining };
  }

  // Check if basic (audio-only = 1 credit) is possible
  if (credits.remaining >= 1) {
    return { allowed: true, degraded: true, cost: 1, remaining: credits.remaining };
  }

  return { allowed: false, degraded: false, cost, remaining: credits.remaining };
}
