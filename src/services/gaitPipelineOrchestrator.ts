// Full pipeline orchestrator — chains all analysis stages with resilient calls

import type { GaitAnalysisResult, AudioMetrics, EnrichedGaitResult, DetectConditionsResult, KeypointsData, KinematicMetrics, WindowQualityMetrics, ConsistencyCriticResult } from "@/types/gait";
import type { GaitFeatureVector } from "@/types/biomech";
import type { DecisionResult, ReasonCode, CreditTier } from "@/types/pipeline";
import { isPoseEngineAvailable, getKeypointsFromPoseEngine, disposePoseEngine, MIN_MEAN_CONFIDENCE, type KeypointsSource } from "@/services/poseKeypointsService";
import type { CalibrationData } from "@/components/CalibrationWizard";
import { extractFrames, extractDenseFrames } from "@/lib/extractFrames";
import { extractAudioMetrics } from "@/lib/audioProcessing";
import { extractBiomechMetrics, keypointsDataToFrames, computeWindowQualityMetrics, smoothKeypoints } from "@/lib/biomechanics";
import { segmentAndAnalyzeStrides } from "@/lib/strideSegmentation";
import { computeValidationReport } from "@/lib/validationMetrics";
import { buildDecisionContext, makeDecision, buildDecisionTrace, buildExplainability, buildInputQuality, computeRequiresVetReview } from "@/lib/decisionEngine";
import { getModel, getVersion, getRulesetHash } from "@/lib/modelVersioning";
import { computeSealLevel } from "@/components/QualitySeal";
import { recordPipelineRun } from "@/services/pipelineTelemetry";
import { checkCredits, consumeCredits, calculateCost } from "@/services/creditService";
import {
  analyzeGait,
  analyzeGaitCombined,
  detectKeypoints,
  calculateMetrics,
  mergeMultiModal,
  detectConditions,
  saveGaitAnalysis,
  selectAnalysisWindows,
  classifyConsistencyCheck,
  criticAndConditions,
  computeVideoHash,
  findCachedAnalysis,
  type AnalyzeGaitParams,
  type CombinedVisionResult,
} from "@/services/gaitAnalysisService";

export type PipelineStageKey =
  | "frames"
  | "audio"
  | "vision"
  | "keypoints"
  | "metrics"
  | "window-select"
  | "biomech"
  | "critic"
  | "merge"
  | "conditions"
  | "saving"
  | "done";

export interface PipelineStageStatus {
  key: PipelineStageKey;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  error?: string;
  startedAt?: number;
  durationMs?: number;
}

export interface PipelineProgress {
  stage: PipelineStageKey;
  progress: number; // 0-100
  stages: PipelineStageStatus[];
}

export type AnalysisMode = "vision" | "audio" | "both";

export interface PipelineParams {
  file: File;
  includeAudio: boolean;
  analysisMode?: AnalysisMode;
  dmrt3Genotype?: string;
  horseName?: string;
  breedId?: string;
  horseId?: string;
  trainingLevel?: string;
  analysisGoal?: string;
  filmingCondition?: string;
  notes?: string;
  horseHeightCm?: number;
  calibrationData?: CalibrationData;
  primaryGoal?: string;
  targetStyle?: string;
  primaryUse?: string;
  outputPreference?: string[];
  additionalInfo?: string;
  userId?: string;
  userTier?: CreditTier;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  onProgress: (p: PipelineProgress) => void;
  onPartialResult?: (partial: Partial<EnrichedGaitResult>) => void;
  skipCache?: boolean;
  automaticSources?: boolean;
}

const STAGE_KEYS: PipelineStageKey[] = [
  "frames", "audio", "vision", "keypoints", "metrics", "window-select", "biomech", "critic", "merge", "conditions", "saving", "done",
];

function makeStages(): PipelineStageStatus[] {
  return STAGE_KEYS.map((key) => ({ key, status: "pending" as const }));
}

function updateStage(
  stages: PipelineStageStatus[],
  key: PipelineStageKey,
  status: PipelineStageStatus["status"],
  error?: string
): PipelineStageStatus[] {
  return stages.map((s) => {
    if (s.key !== key) return s;
    const startedAt = status === "running" ? performance.now() : s.startedAt;
    const durationMs = startedAt !== undefined && status !== "running" && status !== "pending" ? Math.round(performance.now() - startedAt) : s.durationMs;
    return { ...s, status, error, startedAt, durationMs };
  });
}

const PROGRESS_MAP: Record<PipelineStageKey, number> = {
  frames: 5,
  audio: 12,
  vision: 30,
  keypoints: 42,
  metrics: 52,
  "window-select": 60,
  biomech: 72,
  critic: 80,
  merge: 85,
  conditions: 92,
  saving: 97,
  done: 100,
};

// --- Abort helpers ---

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function bindAbortToWorker(signal: AbortSignal | undefined, worker: Worker) {
  if (!signal) return () => {};
  if (signal.aborted) {
    worker.terminate();
    throw new DOMException("Aborted", "AbortError");
  }
  const onAbort = () => {
    try { worker.postMessage({ type: "CANCEL" }); } catch {}
    worker.terminate();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}

function withAbortRace<T>(signal: AbortSignal | undefined, promise: Promise<T>): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { signal.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}

export async function runGaitPipeline(params: PipelineParams): Promise<EnrichedGaitResult> {
  const startTime = performance.now();
  const correlationId = crypto.randomUUID();
  let mode: AnalysisMode = params.analysisMode || "both";
  const signal = params.signal;
  let stages = makeStages();
  const report = (stage: PipelineStageKey) => {
    params.onProgress({ stage, progress: PROGRESS_MAP[stage], stages });
  };

  // --- Video hash caching ---
  let videoHash: string | undefined;
  if (!params.skipCache) {
    try {
      videoHash = await computeVideoHash(params.file);
      const cached = await findCachedAnalysis(videoHash, params.horseId);
      if (cached && (!params.automaticSources || (cached.result as EnrichedGaitResult).sourceSelection?.automatic)) {
        // Return cached result immediately
        stages = stages.map(s => ({ ...s, status: "done" as const }));
        params.onProgress({ stage: "done", progress: 100, stages });
        return {
          ...(cached.result as EnrichedGaitResult),
          savedAnalysisId: cached.id,
          pipelineStages: stages,
          pipelineSucceededCount: stages.length,
          pipelineTotalCount: STAGE_KEYS.length,
          processingTimeMs: Math.round(performance.now() - startTime),
        };
      }
    } catch { /* hash failed, proceed normally */ }
  }

  // --- Credit check ---
  let degradedMode = false;
  let keypointsSource: KeypointsSource = "llm";
  let poseEngineMeanConfidence: number | undefined;
  if (params.userId) {
    const creditCheck = await checkCredits(params.userId, mode);
    if (!creditCheck.allowed) {
      throw new Error("אין מספיק קרדיטים לניתוח. נסה שוב מאוחר יותר.");
    }
    degradedMode = creditCheck.degraded;
  }

  // --- Stages 1+2: Extract frames & audio IN PARALLEL ---
  throwIfAborted(signal);
  stages = updateStage(stages, "frames", "running");
  if (mode !== "vision" && (params.includeAudio || mode === "audio")) {
    stages = updateStage(stages, "audio", "running");
  }
  report("frames");

  const frameCount = mode === "audio" ? 2 : 6;
  let audioMetrics: AudioMetrics | null = null;
  let frames: string[];

  const shouldExtractAudio = mode !== "vision" && (params.includeAudio || mode === "audio" || mode === "both");

  if (shouldExtractAudio) {
    // Run frames + audio in parallel for ~30% time savings
    const [framesResult, audioResult] = await Promise.allSettled([
      withAbortRace(signal, extractFrames(params.file, frameCount, undefined, signal)),
      withAbortRace(signal, extractAudioMetrics(params.file)),
    ]);

    if (framesResult.status === "rejected") throw framesResult.reason;
    frames = framesResult.value;
    stages = updateStage(stages, "frames", "done");

    if (audioResult.status === "fulfilled" && audioResult.value) {
      audioMetrics = audioResult.value;
      stages = updateStage(stages, "audio", "done");
    } else {
      stages = updateStage(stages, "audio", audioResult.status === "rejected" ? "failed" : "skipped",
        audioResult.status === "rejected" ? (audioResult.reason as Error).message : undefined);
    }
  } else {
    frames = await withAbortRace(signal, extractFrames(params.file, frameCount, undefined, signal));
    stages = updateStage(stages, "frames", "done");
    stages = updateStage(stages, "audio", mode === "vision" ? "skipped" : "skipped");
  }

  // --- Stage 3 + 4: Vision + Keypoints (COMBINED single AI call) ---
  let analysis: GaitAnalysisResult;
  let keypointsData: KeypointsData[] | null = null;
  let calibration: Record<string, unknown> | null = null;
  let perKeypointVisibility: Record<string, { mean: number; occludedPct: number }> | null = null;

  if (mode === "audio") {
    stages = updateStage(stages, "vision", "skipped");
    stages = updateStage(stages, "keypoints", "skipped");
    report("keypoints");

    analysis = {
      gaitType: "unknown",
      gaitTypeHebrew: "זוהה מאודיו בלבד",
      overallScore: 0,
      confidence: 0,
      lateralSync: { percentage: 0, description: "לא זמין — מצב אודיו בלבד" },
      symmetry: { score: 0, leftRightDifference: 0, lamenessRisk: "none", lamenessDescription: "לא זמין — מצב אודיו בלבד" },
      beatPattern: audioMetrics ? `${audioMetrics.beatCount} beats` : "N/A",
      beatTracker: { isDirty: false, offsetPercentage: 0, dirtyDescription: "", impactTimes: [] },
      extension: { frontLegs: 0, hindLegs: 0, quality: "fair", description: "לא זמין — מצב אודיו בלבד" },
      trainingRecommendations: [],
      summary: "ניתוח זה מבוסס על אודיו בלבד — מדדים ויזואליים אינם זמינים.",
      keypoints: { detected: false },
    } as GaitAnalysisResult;
  } else {
    throwIfAborted(signal);
    stages = updateStage(stages, "vision", "running");
    stages = updateStage(stages, "keypoints", "running");
    report("vision");

    const analyzeParams: AnalyzeGaitParams = {
      frames,
      automaticSources: params.automaticSources,
      signal,
      dmrt3Genotype: params.dmrt3Genotype,
      horseName: params.horseName,
      breedId: params.breedId,
      trainingLevel: params.trainingLevel,
      analysisGoal: params.analysisGoal,
      filmingCondition: params.filmingCondition,
      notes: params.notes,
      horseHeightCm: params.horseHeightCm,
      audioMetrics: audioMetrics || undefined,
      calibrationData: params.calibrationData,
      primaryGoal: params.primaryGoal,
      targetStyle: params.targetStyle,
      primaryUse: params.primaryUse,
      outputPreference: params.outputPreference,
      additionalInfo: params.additionalInfo,
    };

    // Determine if pose engine should be used (Coach/Gold tier only)
    const usePoseEngine = params.userTier === "coach";
    let poseEngineAttempted = false;

    // Use combined call (single AI request for both vision + keypoints)
    try {
      const combinedResult = await withAbortRace(signal, analyzeGaitCombined(analyzeParams));
      analysis = combinedResult.analysis;
      stages = updateStage(stages, "vision", "done");

      // Emit partial result after vision completes
      params.onPartialResult?.({ ...analysis, analysisMode: mode });

      if (combinedResult.detailedKeypoints) {
        keypointsData = combinedResult.detailedKeypoints.keypoints;
        calibration = combinedResult.detailedKeypoints.calibration as Record<string, unknown>;
        perKeypointVisibility = combinedResult.detailedKeypoints.perKeypointVisibility || null;
        stages = updateStage(stages, "keypoints", "done");
      } else {
        stages = updateStage(stages, "keypoints", "failed", "No keypoints in combined response");
      }
    } catch (combinedErr) {
      // Re-throw abort errors immediately
      if ((combinedErr as any)?.name === "AbortError") throw combinedErr;
      // Fallback: try separate calls in parallel
      console.warn("Combined call failed, falling back to separate calls:", (combinedErr as Error).message);
      throwIfAborted(signal);
      const [visionResult, keypointsResult] = await Promise.allSettled([
        withAbortRace(signal, analyzeGait(analyzeParams)),
        withAbortRace(signal, detectKeypoints(frames, params.horseHeightCm)),
      ]);

      if (visionResult.status === "rejected") {
        stages = updateStage(stages, "vision", "failed", visionResult.reason?.message);
        throw visionResult.reason;
      }
      analysis = visionResult.value;
      stages = updateStage(stages, "vision", "done");
      params.onPartialResult?.({ ...analysis, analysisMode: mode });

      if (keypointsResult.status === "fulfilled") {
        keypointsData = keypointsResult.value.keypoints;
        calibration = keypointsResult.value.calibration as Record<string, unknown>;
        if ((keypointsResult.value as any).perKeypointVisibility) {
          perKeypointVisibility = (keypointsResult.value as any).perKeypointVisibility;
        }
        stages = updateStage(stages, "keypoints", "done");
      } else {
        stages = updateStage(stages, "keypoints", "failed", keypointsResult.reason?.message);
      }
    }

    // --- Pose Engine override for Coach/Gold tier ---
    if (usePoseEngine && !degradedMode && frames.length >= 3) {
      try {
        const modelAvailable = await isPoseEngineAvailable();
        if (modelAvailable) {
          poseEngineAttempted = true;
          // PoseEngine ONNX inference attempt
          throwIfAborted(signal);
          const poseResult = await withAbortRace(signal, getKeypointsFromPoseEngine(frames, 30));
          poseEngineMeanConfidence = poseResult.meanConfidence;

          if (poseResult.meanConfidence >= MIN_MEAN_CONFIDENCE) {
            // Pose engine succeeded with sufficient confidence — override LLM keypoints
            keypointsData = poseResult.keypoints;
            keypointsSource = "pose_engine";
            stages = updateStage(stages, "keypoints", "done");
            // PoseEngine success
          } else {
            // Low confidence — keep LLM keypoints, mark as hybrid
            keypointsSource = "hybrid_repair";
          }
        }
      } catch {
        // Pose engine failed — continue with LLM keypoints
        keypointsSource = "llm";
      }
    }

    report("keypoints");
  }

  if (params.automaticSources) {
    mode = (analysis as EnrichedGaitResult).analysisMode || "vision";
    if (!(analysis as EnrichedGaitResult).sourceSelection?.visionUsed) { keypointsData = null; calibration = null; }
    if (!(analysis as EnrichedGaitResult).sourceSelection?.audioUsed) audioMetrics = null;
  }

  // --- Stages 5+6: Calculate metrics & Window selection IN PARALLEL ---
  throwIfAborted(signal);
  let kinematicMetrics: KinematicMetrics | null = null;
  let metricsExtra: any = {};
  let selectedWindowIndices: number[] | null = null;

  const canRunMetrics = mode !== "audio" && keypointsData && calibration && !analysis.kinematicMetrics;
  const canRunWindowSelect = false; // Skip window-select for speed — local biomech handles it

  if (canRunMetrics || canRunWindowSelect) {
    stages = updateStage(stages, "metrics", canRunMetrics ? "running" : "skipped");
    stages = updateStage(stages, "window-select", canRunWindowSelect ? "running" : "skipped");
    report("metrics");

    const metricsPromise = canRunMetrics
      ? withAbortRace(signal, calculateMetrics(
          keypointsData!,
          calibration!,
          params.horseHeightCm,
          30,
          analysis.gaitType,
          analysis.lateralSync?.percentage,
          audioMetrics?.bpm,
          audioMetrics?.regularity,
        ))
      : Promise.resolve(null);

    const windowPromise = canRunWindowSelect
      ? (async () => {
          const biomechFrames = keypointsDataToFrames(keypointsData!, 30);
          const windowMetrics = computeWindowQualityMetrics(biomechFrames, 30);
          if (windowMetrics.length > 0) {
            return selectAnalysisWindows(windowMetrics, {
              targetK: 3, windowSec: 3, overlap: 0.5, minQuality: 0.4, minDistanceWindows: 1,
            });
          }
          return null;
        })()
      : Promise.resolve(null);

    const [metricsResult, windowResult] = await Promise.allSettled([metricsPromise, windowPromise]);

    if (canRunMetrics) {
      if (metricsResult.status === "fulfilled" && metricsResult.value) {
        const mr = metricsResult.value as any;
        kinematicMetrics = mr.kinematicMetrics;
        metricsExtra = mr;
        stages = updateStage(stages, "metrics", "done");
      } else if (metricsResult.status === "rejected") {
        stages = updateStage(stages, "metrics", "failed", (metricsResult.reason as Error).message);
      }
    }

    if (canRunWindowSelect) {
      if (windowResult.status === "fulfilled" && windowResult.value) {
        const wr = windowResult.value as any;
        if (!wr.abstain && wr.selected?.length > 0) {
          selectedWindowIndices = wr.selected.map((s: any) => s.index);
        }
        stages = updateStage(stages, "window-select", "done");
      } else if (windowResult.status === "rejected") {
        stages = updateStage(stages, "window-select", "failed", (windowResult.reason as Error).message);
      }
    }
  } else {
    stages = updateStage(stages, "metrics", "skipped");
    stages = updateStage(stages, "window-select", "skipped");
  }

  // --- Stage 7: Client-side deterministic biomechanics ---
  let mergedAnalysis = { ...analysis };

  if (mode === "audio") {
    stages = updateStage(stages, "biomech", "skipped");
  } else {
    stages = updateStage(stages, "biomech", "running");
    report("biomech");
    try {
      // Six sampled/LLM keyframes are not a continuous measured pose sequence.
      if (keypointsSource === "pose_engine" && keypointsData && keypointsData.length > 30) {
        const biomechFrames = keypointsDataToFrames(keypointsData, 30);

        if (perKeypointVisibility) {
          for (const frame of biomechFrames) {
            if (!frame.conf) frame.conf = {};
            for (const [kp, vis] of Object.entries(perKeypointVisibility)) {
              if (vis.occludedPct > 0.35) {
                frame.conf[kp] = (frame.conf[kp] ?? 1) * 0.5;
              }
            }
          }
        }

        // Apply Butterworth smoothing + anatomical constraints + outlier rejection
        smoothKeypoints(biomechFrames, 30);

        if (biomechFrames.length > 5) {
          const biomechMetrics = extractBiomechMetrics({ fps: 30, frames: biomechFrames }, params.breedId);

          // Compute validation KPIs
          try {
            biomechMetrics.validationReport = computeValidationReport(biomechFrames, 30, biomechMetrics);
          } catch { /* non-critical */ }

          // Stride segmentation (per-stride metrics)
          let strideSegResult;
          try {
            strideSegResult = segmentAndAnalyzeStrides(
              biomechFrames,
              30,
              biomechMetrics.hoofPhases,
            );
          } catch { /* non-critical */ }

          mergedAnalysis.biomechMetrics = biomechMetrics;
          mergedAnalysis.headPelvisMetrics = biomechMetrics.headPelvis;
          mergedAnalysis.backMetrics = biomechMetrics.back;

          // Attach stride segmentation to enriched result (will be carried to final output)
          (mergedAnalysis as any)._strideSegmentation = strideSegResult;
        }
      }
      stages = updateStage(stages, "biomech", "done");
    } catch (e) {
      stages = updateStage(stages, "biomech", "failed", (e as Error).message);
    }
  }

  throwIfAborted(signal);
  // --- Stages 8+9+10: Critic + Merge + Conditions IN PARALLEL (saves ~30-40s) ---
  let decisionResult: DecisionResult | undefined;
  let conditionsResult: DetectConditionsResult | null = null;

  const windowQualities = mergedAnalysis.biomechMetrics?.windows?.map((w: any) => w.quality) ?? [];
  const inputQuality = buildInputQuality(perKeypointVisibility, windowQualities);

  // Skip merge edge function call — use local deterministic merge instead
  stages = updateStage(stages, "merge", "running");
  try {
    // Local merge: combine audio + vision without calling edge function
    if (audioMetrics && analysis.audioAnalysis) {
      const vConf = typeof analysis.confidence === "number" ? analysis.confidence / 100 : 0.5;
      const aConf = typeof analysis.audioAnalysis?.audioConfidence === "number" ? analysis.audioAnalysis.audioConfidence / 100 : 0.3;
      let fusedConf = vConf * 0.6 + aConf * 0.4;
      const agreement = analysis.multiModalFusion?.agreement !== false;
      if (!agreement) fusedConf = Math.max(0, fusedConf - 0.20);
      const fusion = {
        ...mergedAnalysis.multiModalFusion,
        fusedConfidence: Math.round(Math.max(0, Math.min(1, fusedConf)) * 100),
      };
      (fusion as any)._serverValidated = true;
      mergedAnalysis.multiModalFusion = fusion;
    }
    stages = updateStage(stages, "merge", "done");
  } catch (e) { stages = updateStage(stages, "merge", "failed", (e as Error).message); }

  const criticPromise = (async () => {
    if (degradedMode || mode === "audio" || !mergedAnalysis.biomechMetrics?.gait) {
      stages = updateStage(stages, "critic", "skipped");
      stages = updateStage(stages, "conditions", "skipped");
      if (mergedAnalysis.biomechMetrics?.gait) {
        const ctx = buildDecisionContext(mergedAnalysis.biomechMetrics, mode, analysis.gaitType, analysis.confidence, undefined, params.breedId, perKeypointVisibility);
        ctx.inputQuality = inputQuality;
        decisionResult = makeDecision(ctx, mergedAnalysis.biomechMetrics.gait);
      }
      return;
    }
    stages = updateStage(stages, "critic", "running");
    stages = updateStage(stages, "conditions", "running");
    report("critic");
    try {
      const gait = mergedAnalysis.biomechMetrics!.gait;
      const bestFeatures: GaitFeatureVector | undefined = (gait as any).features;
      const criticInput = {
        classification: gait.classification, confidence: gait.confidence,
        features: bestFeatures || { meanLateralLag: 0, stdLateralLag: 0, meanDiagonalLag: 0, stdDiagonalLag: 0, beatEvenness: 0, strideVariability: 0, headPelvisStability: 0, suspensionProxy: 0, contactEventConfidence: 0, footfallOrder: "unknown" },
        windowVoteBreakdown: gait.windowVotes || {}, qualityWindows: gait.qualityWindows || 0, totalWindows: gait.totalWindows || 0,
      };
      const combinedResult = await criticAndConditions({ criticInput, analysisResult: mergedAnalysis });
      const criticResult: ConsistencyCriticResult = combinedResult.critic;
      const ctx = buildDecisionContext(mergedAnalysis.biomechMetrics!, mode, analysis.gaitType, analysis.confidence, undefined, params.breedId, perKeypointVisibility);
      ctx.inputQuality = inputQuality;
      decisionResult = makeDecision(ctx, gait, criticResult);
      if (mergedAnalysis.biomechMetrics) {
        mergedAnalysis.biomechMetrics.gait.confidence = decisionResult.confidence;
        mergedAnalysis.biomechMetrics.gait.classification = decisionResult.classification as any;
      }
      stages = updateStage(stages, "critic", "done");
      if (combinedResult.conditions) {
        conditionsResult = { ...combinedResult.conditions, riskScreening: combinedResult.riskScreening } as DetectConditionsResult;
        stages = updateStage(stages, "conditions", "done");
      } else { stages = updateStage(stages, "conditions", "skipped"); }
    } catch (e) {
      stages = updateStage(stages, "critic", "failed", (e as Error).message);
      stages = updateStage(stages, "conditions", "failed", (e as Error).message);
      if (mergedAnalysis.biomechMetrics?.gait) {
        const ctx = buildDecisionContext(mergedAnalysis.biomechMetrics, mode, analysis.gaitType, analysis.confidence, undefined, params.breedId, perKeypointVisibility);
        ctx.inputQuality = inputQuality;
        decisionResult = makeDecision(ctx, mergedAnalysis.biomechMetrics.gait);
        decisionResult.criticWarnings.push("CRITIC_UNAVAILABLE");
      }
      try { conditionsResult = await detectConditions(mergedAnalysis); stages = updateStage(stages, "conditions", "done"); } catch { /* non-critical */ }
    }
  })();

  await criticPromise;
  // merge is now synchronous (local), no need to await
  const criticWarnings = decisionResult?.criticWarnings ?? [];

  // Apply server-side metrics extras
  if (metricsExtra.headPelvisMetrics) {
    mergedAnalysis.headPelvisMetrics = mergedAnalysis.headPelvisMetrics || (metricsExtra.headPelvisMetrics as any);
  }
  if (metricsExtra.backMetrics) {
    mergedAnalysis.backMetrics = mergedAnalysis.backMetrics || (metricsExtra.backMetrics as any);
  }
  if (kinematicMetrics) {
    mergedAnalysis.kinematicMetrics = mergedAnalysis.kinematicMetrics || kinematicMetrics;
  }

  // --- Stage 11: Save (snapshots upload + DB save in parallel) ---
  throwIfAborted(signal);
  stages = updateStage(stages, "saving", "running");
  report("saving");

  // Start snapshot upload as a background promise (non-blocking)
  const snapshotPromise = (async (): Promise<string[]> => {
    if (!(frames.length > 0 && params.userId)) return [];
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const snapshotFrames = frames.slice(0, 2); // Save 2 key frames (was 3, saves ~33% upload time)
      const uploadPromises = snapshotFrames.map(async (frame, idx) => {
        const base64Data = frame.replace(/^data:image\/\w+;base64,/, "");
        const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const path = `${params.userId}/${crypto.randomUUID()}-frame-${idx}.jpg`;
        const { error } = await supabase.storage.from("horse-videos").upload(path, bytes, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (!error) {
          const { data: urlData } = supabase.storage.from("horse-videos").getPublicUrl(path);
          return urlData.publicUrl;
        }
        return null;
      });
      const results = await Promise.allSettled(uploadPromises);
      return results
        .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled")
        .map(r => r.value)
        .filter((url): url is string => !!url);
    } catch { return []; }
  })();

  // Save DB record immediately — don't block on snapshot upload
  let snapshotUrls: string[] = [];
  try {
    // Give snapshots a short window (3s) then proceed without them
    snapshotUrls = await Promise.race([
      snapshotPromise,
      new Promise<string[]>(resolve => setTimeout(() => resolve([]), 3000)),
    ]);
  } catch { /* proceed without snapshots */ }
  let savedId: string | null = null;

  // --- Done ---
  // Keep saving active until persistence completes.

  const processingTimeMs = Math.round(performance.now() - startTime);
  const succeededCount = stages.filter((s) => s.status === "done").length;

  // Record telemetry (fire-and-forget)
  const creditCharged = !!params.userId;
  if (params.userId) {
    recordPipelineRun(stages, savedId, params.userId, decisionResult, processingTimeMs, mode, correlationId, creditCharged);
  }

  // Build decision trace for reproducibility
  const criticUsed = stages.find(s => s.key === "critic")?.status === "done";
  const windowSelectorUsed = stages.find(s => s.key === "window-select")?.status === "done";
  const breedPriorDelta = mergedAnalysis.biomechMetrics?.gait?.breedPriorDelta;
  const decisionTrace = buildDecisionTrace(mode, criticUsed, windowSelectorUsed, breedPriorDelta);
  decisionTrace.keypointsSource = keypointsSource;
  decisionTrace.poseEngineMeanConfidence = poseEngineMeanConfidence;

  // Build explainability
  let explainability;
  if (decisionResult && mergedAnalysis.biomechMetrics?.gait) {
    const ctx = buildDecisionContext(
      mergedAnalysis.biomechMetrics, mode,
      analysis.gaitType, analysis.confidence,
      undefined, params.breedId, perKeypointVisibility,
    );
    explainability = buildExplainability(ctx, decisionResult);
  }

  // Compute quality seal level for persistence
  let qualitySealLevel: "gold" | "silver" | "bronze" | "none" | undefined;
  let qualitySealScore: number | undefined;
  try {
    let windowQualityAvg: number | undefined;
    if (mergedAnalysis.biomechMetrics?.windows && mergedAnalysis.biomechMetrics.windows.length > 0) {
      const qualities = mergedAnalysis.biomechMetrics.windows.map((w: any) => w.quality * 100);
      windowQualityAvg = qualities.reduce((a: number, b: number) => a + b, 0) / qualities.length;
    }
    let occlusionRate: number | undefined;
    if (mergedAnalysis.biomechMetrics?.quality?.missingRate) {
      const rates = Object.values(mergedAnalysis.biomechMetrics.quality.missingRate) as number[];
      if (rates.length > 0) occlusionRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    }
    const sealData = {
      visionAudioAgreement: mergedAnalysis.multiModalFusion?.agreement ?? true,
      fusedConfidence: mergedAnalysis.multiModalFusion?.fusedConfidence ?? mergedAnalysis.confidence ?? 0,
      calibrationConfidence: 0,
      rhythmRegularity: mergedAnalysis.audioAnalysis?.rhythmRegularity ?? 70,
      symmetryScore: mergedAnalysis.symmetry?.score ?? 0,
      captureQualityScore: 2,
      windowQualityAvg,
      occlusionRate,
    };
    const seal = computeSealLevel(sealData);
    qualitySealLevel = seal.level;
    qualitySealScore = seal.score;
  } catch { /* non-critical */ }

  // Compute deterministic requiresVetReview for conditions
  if (conditionsResult) {
    conditionsResult.screeningOnly = true;
    conditionsResult.intendedUse = "screening_support";
    conditionsResult.notDiagnostic = true;
    conditionsResult.requiresVetReview = computeRequiresVetReview({
      qualitySealLevel,
      decisionOutcome: decisionResult?.outcome,
      agreementScoreOverall: mergedAnalysis.multiModalFusion?.agreementScoreOverall,
      conflictSeverities: mergedAnalysis.multiModalFusion?.conflicts?.map(c => c.severity),
      limitations: mergedAnalysis.multiModalFusion?.limitations,
      conditionRiskLevels: conditionsResult.conditions.map(c => c.risk),
    });
    // Collect all objective metrics used across conditions
    conditionsResult.objectiveMetricsUsed = [...new Set(
      conditionsResult.conditions.flatMap(c => c.objectiveMetricsUsed ?? [])
    )];
  }

  const enrichedResult: EnrichedGaitResult = {
    ...mergedAnalysis,
    analysisMode: mode,
    conditions: conditionsResult || undefined,
    pipelineStages: stages,
    pipelineSucceededCount: succeededCount,
    pipelineTotalCount: STAGE_KEYS.length,
    processingTimeMs,
    savedAnalysisId: savedId,
    criticWarnings: criticWarnings.length > 0 ? criticWarnings : undefined,
    decision: decisionResult,
    degradedMode,
    decisionTrace,
    qualitySealLevel,
    qualitySealScore,
    explainability,
    strideSegmentation: (mergedAnalysis as any)._strideSegmentation ?? undefined,
  };

  savedId = await saveGaitAnalysis(enrichedResult, {
    horseName: params.horseName, breedId: params.breedId,
    dmrt3Genotype: params.dmrt3Genotype, horseId: params.horseId,
  }, mode, videoHash, snapshotUrls);
  enrichedResult.savedAnalysisId = savedId;
  stages = updateStage(stages, "saving", savedId ? "done" : "failed", savedId ? undefined : "Result could not be saved");
  stages = updateStage(stages, "done", "done");
  enrichedResult.pipelineStages = stages;
  enrichedResult.processingTimeMs = Math.round(performance.now() - startTime);
  report("done");
  // Consume credits after successful analysis
  if (params.userId && savedId) {
    const cost = degradedMode ? 1 : calculateCost(mode);
    await consumeCredits(params.userId, cost);
  }

  return enrichedResult;
}
