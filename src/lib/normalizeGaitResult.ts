import type { GaitAnalysisResult } from "@/types/gait";

function narrative(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(narrative).filter(Boolean).join(" · ");
  if (value && typeof value === "object") return Object.values(value).map(narrative).filter(Boolean).join(" · ");
  return "";
}

const record = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const list = (value: unknown): any[] => Array.isArray(value) ? value.filter(item => item != null) : [];

/** AI narratives can arrive as structured objects; never render those as React children. */
export function normalizeGaitResult(result: GaitAnalysisResult): GaitAnalysisResult {
  return {
    ...result,
    summary: narrative(result.summary),
    breedSpecificNotes: narrative(result.breedSpecificNotes),
    goalFocusedSummary: narrative(result.goalFocusedSummary),
    gaitTypeHebrew: narrative(result.gaitTypeHebrew),
    beatPattern: narrative(result.beatPattern),
    lateralSync: { ...result.lateralSync, description: narrative(result.lateralSync?.description) },
    symmetry: { ...result.symmetry, lamenessDescription: narrative(result.symmetry?.lamenessDescription) },
    extension: { ...result.extension, description: narrative(result.extension?.description) },
    beatTracker: { ...result.beatTracker, dirtyDescription: narrative(result.beatTracker?.dirtyDescription) },
    ...(result.audioAnalysis ? { audioAnalysis: {
      ...result.audioAnalysis,
      beatPattern: narrative(result.audioAnalysis.beatPattern),
      weakBeatDescription: narrative(result.audioAnalysis.weakBeatDescription),
      audioGaitClassification: narrative(result.audioAnalysis.audioGaitClassification),
    } } : {}),
    ...(result.multiModalFusion ? { multiModalFusion: {
      ...result.multiModalFusion,
      conflictDescription: narrative(result.multiModalFusion.conflictDescription),
      visionGaitType: narrative(result.multiModalFusion.visionGaitType),
      audioGaitType: narrative(result.multiModalFusion.audioGaitType),
      limitations: list(result.multiModalFusion.limitations).filter(item => typeof item === "string"),
      conflictReasonCodes: list(result.multiModalFusion.conflictReasonCodes).filter(item => typeof item === "string"),
    } } : {}),
    ...(result.biomechMetrics ? { biomechMetrics: {
      ...result.biomechMetrics,
      windows: list(result.biomechMetrics.windows).filter(w => typeof w.quality === "number" && Number.isFinite(w.quality) && w.quality >= 0 && w.quality <= 1 && Object.keys(record(w.features)).length > 0),
    } } : {}),
    trainingRecommendations: Array.isArray(result.trainingRecommendations) ? result.trainingRecommendations.map(item => typeof item === "string" ? item : { title: narrative(item?.title), description: narrative(item?.description) }) : [],
  };
}