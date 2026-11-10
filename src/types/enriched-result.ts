// Enriched pipeline result types

import type { GaitAnalysisResult } from "@/types/gait-core";
import type { DetectConditionsResult } from "@/types/conditions";
import type { DecisionResult } from "@/types/pipeline";

export interface EnrichedGaitResult extends GaitAnalysisResult {
  conditions?: DetectConditionsResult;
  pipelineStages?: Array<{ key: string; status: string; error?: string }>;
  pipelineSucceededCount?: number;
  pipelineTotalCount?: number;
  processingTimeMs?: number;
  stageTimings?: Record<string, number>;
  sourceSelection?: { automatic: boolean; visionUsed: boolean; audioUsed: boolean; reason: string; audioBasis?: string | null };
  savedAnalysisId?: string | null;
  analysisMode?: "vision" | "audio" | "both";
  criticWarnings?: string[];
  classificationReason?: string;
  decision?: DecisionResult;
  degradedMode?: boolean;
  decisionTrace?: import("@/types/pipeline").DecisionTrace;
  qualitySealLevel?: import("@/types/pipeline").QualitySealLevel;
  qualitySealScore?: number;
  explainability?: import("@/types/pipeline").Explainability;
  strideSegmentation?: import("@/types/stride").StrideSegmentationResult;
}
