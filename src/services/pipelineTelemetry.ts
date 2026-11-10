// Pipeline Telemetry — fire-and-forget event recording

import { supabase } from "@/integrations/supabase/client";
import type { PipelineStageStatus } from "@/services/gaitPipelineOrchestrator";
import type { DecisionResult } from "@/types/pipeline";

interface TelemetryEvent {
  analysis_id: string | null;
  user_id: string;
  stage: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Record pipeline run telemetry — non-blocking, fire-and-forget.
 */
export function recordPipelineRun(
  stages: PipelineStageStatus[],
  analysisId: string | null,
  userId: string,
  decision?: DecisionResult,
  processingTimeMs?: number,
  analysisMode?: string,
  correlationId?: string,
  creditCharged?: boolean,
): void {
  // Build one row per stage + one summary
  const events: TelemetryEvent[] = stages
    .filter((s) => s.key !== "done")
    .map((s) => ({
      analysis_id: analysisId,
      user_id: userId,
      stage: s.key,
      status: s.status,
      duration_ms: null,
      error_message: s.error ?? null,
      metadata: {},
    }));

  // Summary row
  const succeededCount = stages.filter((s) => s.status === "done").length;
  const failedCount = stages.filter((s) => s.status === "failed").length;

  events.push({
    analysis_id: analysisId,
    user_id: userId,
    stage: "summary",
    status: failedCount > 0 ? "partial" : "complete",
    duration_ms: processingTimeMs ?? null,
    error_message: null,
    metadata: {
      succeededCount,
      failedCount,
      analysisMode,
      classification: decision?.classification,
      confidenceBefore: decision?.confidenceBeforeCritic,
      confidenceAfter: decision?.confidenceAfterCritic,
      criticApproved: decision?.criticApproved,
      criticOverride: decision ? !decision.criticApproved : false,
      correlationId: correlationId ?? undefined,
      creditCharged: creditCharged ?? undefined,
    },
  });

  // Fire-and-forget
  supabase
    .from("pipeline_events" as any)
    .insert(events as any)
    .then(({ error }) => {
      if (error) console.warn("[Telemetry] Failed to record pipeline events:", error.message);
    });
}
