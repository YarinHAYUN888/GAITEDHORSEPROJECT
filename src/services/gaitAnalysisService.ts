// Gait Analysis Service — refactored to use shared edge function client
// Barrel re-export maintains full backward compatibility

import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/services/edgeFunctionClient";
import { computeVideoHash, findCachedAnalysis } from "@/services/videoCacheService";
import { requireGaitResult } from "@/lib/gaitResultValidation";
import { normalizeGaitResult } from "@/lib/normalizeGaitResult";
import type { GaitAnalysisResult, AudioMetrics, KeypointsData, KinematicMetrics, SuspensionAnalysis, AudioAnalysis, MultiModalFusion, CrossModalValidation, AdvancedMetricsResult, DetectConditionsResult, HeadPelvisMetrics, BackMetrics, WindowQualityMetrics, WindowSelectorResult, ConsistencyCriticResult, LabelFeedbackResult } from "@/types/gait";
import type { GaitClassification } from "@/types/biomech";
import type { CalibrationData } from "@/components/CalibrationWizard";

// Re-export for backward compatibility
export { computeVideoHash, findCachedAnalysis } from "@/services/videoCacheService";
export { callEdgeFunction } from "@/services/edgeFunctionClient";

export interface AnalyzeGaitParams {
  frames: string[];
  dmrt3Genotype?: string;
  horseName?: string;
  breedId?: string;
  trainingLevel?: string;
  analysisGoal?: string;
  filmingCondition?: string;
  notes?: string;
  horseHeightCm?: number;
  audioMetrics?: AudioMetrics;
  calibrationData?: CalibrationData;
  primaryGoal?: string;
  targetStyle?: string;
  primaryUse?: string;
  outputPreference?: string[];
  additionalInfo?: string;
  signal?: AbortSignal;
  quickScan?: boolean;
  automaticSources?: boolean;
}

export async function analyzeGait(params: AnalyzeGaitParams): Promise<GaitAnalysisResult> {
  const { signal, ...payload } = params;
  const data = await callEdgeFunction<{ analysis: GaitAnalysisResult }>("gait-analysis", payload, signal);
  return normalizeGaitResult(requireGaitResult(data?.analysis));
}

// Combined Vision + Keypoints in a single AI call (saves ~40% latency + cost)
export interface CombinedVisionResult {
  analysis: GaitAnalysisResult;
  detailedKeypoints: {
    schemaVersion: number;
    keypoints: KeypointsData[];
    calibration: { estimatedHeightPx: number; pixelsPerCm: number; confidence: number };
    perKeypointVisibility?: Record<string, { mean: number; occludedPct: number }>;
    occlusionNotes?: Array<{ windowIndex: number; keypoint: string; note: string }>;
  } | null;
}

export async function analyzeGaitCombined(params: AnalyzeGaitParams): Promise<CombinedVisionResult> {
  const { signal, ...payload } = params;
  const data = await callEdgeFunction<CombinedVisionResult>("gait-vision-combined", payload, signal);
  return { ...data, analysis: normalizeGaitResult(requireGaitResult(data?.analysis)) };
}

export interface SaveGaitAnalysisContext {
  horseName?: string;
  breedId?: string;
  dmrt3Genotype?: string;
  horseId?: string;
}

// Indexed summary columns are integers; preserve original precision in result_json.
const summaryInteger = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;

export async function saveGaitAnalysis(analysis: GaitAnalysisResult, context: SaveGaitAnalysisContext, analysisMode?: string, videoHash?: string, snapshotUrls?: string[]): Promise<string | null> {
  try {
  analysis = normalizeGaitResult(requireGaitResult(analysis));
  const { data, error } = await supabase.from("gait_analyses").insert({
    analysis_mode: analysisMode || "both",
    horse_id: context.horseId || null,
    horse_name: context.horseName || null,
    breed_id: context.breedId || null,
    dmrt3_genotype: context.dmrt3Genotype && context.dmrt3Genotype !== "none" ? context.dmrt3Genotype : null,
    overall_score: summaryInteger(analysis.overallScore),
    gait_type: analysis.gaitType ?? null,
    gait_type_hebrew: analysis.gaitTypeHebrew ?? null,
    lateral_sync_pct: summaryInteger(analysis.lateralSync?.percentage),
    symmetry_score: summaryInteger(analysis.symmetry?.score),
    beat_pattern: analysis.beatPattern ?? null,
    confidence: summaryInteger(analysis.confidence),
    lameness_risk: analysis.symmetry?.lamenessRisk ?? null,
    is_dirty: analysis.beatTracker?.isDirty ?? false,
    audio_bpm: analysis.audioAnalysis?.detectedBPM ?? null,
    audio_regularity: analysis.audioAnalysis?.rhythmRegularity ?? null,
    audio_gait_classification: analysis.audioAnalysis?.audioGaitClassification ?? null,
    vision_audio_conflict: analysis.multiModalFusion?.agreement === false,
    conflict_description: analysis.multiModalFusion?.conflictDescription ?? null,
    result_json: analysis as any,
    model_version: "2.1.0",
    video_hash: videoHash || null,
    snapshot_urls: snapshotUrls && snapshotUrls.length > 0 ? snapshotUrls : [],
    enriched_data: {
      decisionTrace: (analysis as any).decisionTrace,
      explainability: (analysis as any).explainability,
      qualitySealLevel: (analysis as any).qualitySealLevel,
      qualitySealScore: (analysis as any).qualitySealScore,
      biomechSummary: analysis.biomechMetrics?.gait ? {
        classification: analysis.biomechMetrics.gait.classification,
        confidence: analysis.biomechMetrics.gait.confidence,
      } : null,
    },
  }).select("id").abortSignal(AbortSignal.timeout(10_000)).single();

  if (error) {
    console.error("Failed to save gait analysis:", error);
    return null;
  }
  return data?.id ?? null;
  } catch {
    // A transport failure must not discard an already completed analysis.
    return null;
  }
}

// --- Specialized edge function wrappers ---

export async function detectKeypoints(frames: string[], horseHeightCm?: number) {
  return callEdgeFunction<{
    keypoints: KeypointsData[];
    calibration: { estimatedHeightPx: number; pixelsPerCm: number; confidence: number };
    schemaVersion?: number;
    perKeypointVisibility?: Record<string, { mean: number; occludedPct: number }>;
    occlusionNotes?: Array<{ windowIndex: number; keypoint: string; note: string }>;
  }>("detect-horse-keypoints", { frames, horseHeightCm });
}

export async function analyzeAudioAdvanced(
  audioMetrics: AudioMetrics,
  breedId?: string,
  dmrt3Genotype?: string,
  expectedGaitType?: string,
  visionSyncScore?: number
) {
  return callEdgeFunction<{
    audioAnalysis: AudioAnalysis;
    segments: Array<{ startSec: number; endSec: number; bpm: number; gaitType: string; notes: string }>;
    crossModalValidation: CrossModalValidation;
    recommendations: string[];
    warnings: string[];
    processing_time_ms: number;
  }>("analyze-gait-audio-advanced", { audioMetrics, breedId, dmrt3Genotype, expectedGaitType, visionSyncScore });
}

export async function calculateMetrics(
  keypoints: KeypointsData[],
  calibration: Record<string, unknown>,
  horseHeightCm?: number,
  fps?: number,
  gaitType?: string,
  syncScore?: number,
  bpm?: number,
  consistencyScore?: number,
  speedKmh?: number
) {
  return callEdgeFunction<AdvancedMetricsResult & {
    headPelvisMetrics?: HeadPelvisMetrics;
    backMetrics?: BackMetrics;
    gaitClassification?: GaitClassification;
  }>(
    "calculate-advanced-metrics",
    { keypoints, calibration, horseHeightCm, fps, gaitType, syncScore, bpm, consistencyScore, speedKmh }
  );
}

export async function mergeMultiModal(
  visionResult: GaitAnalysisResult,
  audioAnalysis?: AudioAnalysis | null,
  keypointsData?: KeypointsData[] | null,
  kinematicMetrics?: KinematicMetrics | null
) {
  return callEdgeFunction<{
    fusedResult: Partial<GaitAnalysisResult>;
    multiModalFusion: MultiModalFusion;
    conflicts: Array<{ source1: string; source2: string; field: string; value1: unknown; value2: unknown; resolution: string }>;
    preCorrelation: { agreementScore: number; discrepancies: string[]; mergedInsights: string[] };
    processing_time_ms: number;
  }>("merge-multimodal-data", { visionResult, audioAnalysis, keypointsData, kinematicMetrics });
}

export async function detectConditions(analysisResult: GaitAnalysisResult, horseHistory?: unknown[]) {
  return callEdgeFunction<DetectConditionsResult>("detect-equine-conditions", { analysisResult, horseHistory });
}

export interface CriticAndConditionsInput {
  criticInput?: {
    classification: string;
    confidence: number;
    features: any;
    windowVoteBreakdown: Record<string, number>;
    qualityWindows: number;
    totalWindows: number;
    stdBeatEvenness?: number;
    stdOrderConsistency?: number;
  };
  analysisResult?: GaitAnalysisResult;
  horseHistory?: unknown[];
}

export interface CriticAndConditionsResult {
  critic: ConsistencyCriticResult;
  conditions: DetectConditionsResult;
  riskScreening: { preComputedRisks: any[]; matchedSignsCount: number };
  processing_time_ms: number;
}

export async function criticAndConditions(input: CriticAndConditionsInput) {
  return callEdgeFunction<CriticAndConditionsResult>("critic-and-conditions", input);
}

// --- LLM Agent wrappers ---

export async function selectAnalysisWindows(
  windows: WindowQualityMetrics[],
  config: {
    targetK?: number;
    windowSec?: number;
    overlap?: number;
    minQuality?: number;
    minDistanceWindows?: number;
  },
  thumbnails?: string[]
) {
  const mode = thumbnails?.length ? "metrics_plus_thumbnails" : "metrics_only";
  return callEdgeFunction<WindowSelectorResult>("select-analysis-windows", {
    mode,
    windows,
    thumbnails: thumbnails || undefined,
    config,
  });
}

export async function classifyConsistencyCheck(data: {
  classification: string;
  confidence: number;
  features: any;
  windowVoteBreakdown: Record<string, number>;
  qualityWindows: number;
  totalWindows: number;
  stdBeatEvenness?: number;
  stdOrderConsistency?: number;
}) {
  return callEdgeFunction<ConsistencyCriticResult>("classify-consistency-check", data);
}

export async function labelFeedback(data: {
  resultJson: object;
  correctedGaitType?: string;
  comment?: string;
  feedbackType: string;
  labelSource?: string;
}) {
  return callEdgeFunction<LabelFeedbackResult>("label-feedback", data);
}
