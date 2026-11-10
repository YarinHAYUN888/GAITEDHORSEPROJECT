// Decision Engine v3 — pure functions decoupled from pipeline orchestration

import type { DecisionContext, DecisionResult, DecisionTrace, Explainability, ExplainItem, DecisionOutcome, ReasonCode, InputQuality } from "@/types/pipeline";
import type { GaitClassification, GaitFeatureVector, ConsistencyCriticResult, BiomechMetrics } from "@/types/biomech";
import type { DetectConditionsResult, ConflictSeverity, FusionLimitation } from "@/types/gait";
import type { QualitySealLevel } from "@/types/pipeline";
import { getVersion, getAllModels, getRulesetHash } from "@/lib/modelVersioning";

const EMPTY_FEATURES: GaitFeatureVector = {
  meanLateralLag: 0,
  stdLateralLag: 0,
  meanDiagonalLag: 0,
  stdDiagonalLag: 0,
  beatEvenness: 0,
  strideVariability: 0,
  headPelvisStability: 0,
  suspensionProxy: 0,
  contactEventConfidence: 0,
  footfallOrder: "unknown",
};

/**
 * Package pipeline intermediates into a DecisionContext.
 */
export function buildDecisionContext(
  biomechMetrics: BiomechMetrics | undefined,
  analysisMode: "vision" | "audio" | "both",
  visionGaitType?: string,
  visionConfidence?: number,
  audioGaitType?: string,
  breedId?: string,
  perKeypointVisibility?: Record<string, { mean: number; occludedPct: number }> | null,
): DecisionContext {
  const gait = biomechMetrics?.gait;
  const features: GaitFeatureVector =
    (gait as any)?.features ?? EMPTY_FEATURES;

  return {
    features,
    windowVotes: gait?.windowVotes ?? {},
    qualityWindows: gait?.qualityWindows ?? 0,
    totalWindows: gait?.totalWindows ?? 0,
    audioGaitType,
    visionGaitType,
    visionConfidence: visionConfidence ?? 0,
    analysisMode,
    breedId,
    perKeypointVisibility: perKeypointVisibility ?? undefined,
  };
}

/**
 * Pure decision function: takes context + optional critic result → DecisionResult.
 * Encapsulates the critic-override logic previously inline in the orchestrator.
 */
export function makeDecision(
  ctx: DecisionContext,
  gait: GaitClassification,
  criticResult?: ConsistencyCriticResult,
): DecisionResult {
  const confidenceBefore = gait.confidence;
  let classification = gait.classification;
  let confidence = gait.confidence;
  const alternatives = gait.alternatives ?? [];
  const classificationReason = gait.classificationReason ?? "";
  const criticWarnings: string[] = [];
  const reasonCodes: ReasonCode[] = [];
  let criticApproved = true;

  // Accumulate input quality reason codes
  if (ctx.inputQuality) {
    reasonCodes.push(...ctx.inputQuality.reasonCodes);
  }

  // Accumulate window drop reason codes
  if (ctx.windowResults) {
    for (const wr of ctx.windowResults) {
      if (wr.dropReasonCodes) reasonCodes.push(...wr.dropReasonCodes);
    }
  }

  if (criticResult) {
    criticApproved = criticResult.approved;

    if (!criticResult.approved) {
      confidence *= criticResult.confidenceAdjustment;
      confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;

      const topAlt = criticResult.alternatives?.[0];
      if (
        topAlt &&
        topAlt.score > 0.8 &&
        criticResult.contradictions &&
        criticResult.contradictions.length >= 2
      ) {
        classification = topAlt.classification as typeof classification;
      }

      criticWarnings.push(...(criticResult.reasonCodes ?? []));
      if (criticResult.contradictions) {
        for (const c of criticResult.contradictions) {
          criticWarnings.push(`${c.metric}: ${c.observed} (expected ${c.expectedRange})`);
        }
      }

      // Map critic warnings to typed reason codes
      if (criticResult.reasonCodes?.some(r => r.includes("EVENNESS"))) reasonCodes.push("C_CONTRADICT_EVENNESS");
      if (criticResult.reasonCodes?.some(r => r.includes("LAG"))) reasonCodes.push("C_LAG_STD_HIGH");
      if (criticResult.reasonCodes?.some(r => r.includes("VARIABILITY"))) reasonCodes.push("C_VARIABILITY_HIGH");
    }
  }

  // Decision-level reason codes
  if (confidence < 0.5) reasonCodes.push("D_LOW_CONFIDENCE");
  if (alternatives.length > 0 && alternatives[0].score > 0.35 && Math.abs(confidence - alternatives[0].score) < 0.15) {
    reasonCodes.push("D_ALTERNATIVES_CLOSE");
  }

  const decisionSource: DecisionResult["decisionSource"] =
    ctx.analysisMode === "audio" ? "audio_only" : "biomech_local";

  const outcome = determineOutcome(ctx, confidence, alternatives, reasonCodes);

  // Deduplicate reason codes
  const uniqueReasonCodes = [...new Set(reasonCodes)];

  return {
    classification,
    confidence,
    alternatives,
    classificationReason,
    criticApproved,
    criticWarnings,
    confidenceBeforeCritic: confidenceBefore,
    confidenceAfterCritic: confidence,
    decisionSource,
    outcome,
    reasonCodes: uniqueReasonCodes,
  };
}

/**
 * Determine the decision outcome based on quality, confidence and alternatives.
 */
export function determineOutcome(
  ctx: DecisionContext,
  confidence: number,
  alternatives: Array<{ classification?: string; score: number }>,
  reasonCodes: ReasonCode[],
): DecisionOutcome {
  // Even with low quality, still show results — just mark as degraded confidence
  // Previously these returned "recapture" which blocked results display
  const isLowQuality =
    (ctx.qualityWindows === 0 && ctx.analysisMode !== "audio") ||
    (ctx.inputQuality && ctx.inputQuality.overall < 0.3) ||
    reasonCodes.includes("D_RECAPTURE_NEEDED");

  // Confident
  if (confidence >= 0.5 && !isLowQuality) {
    return "confident";
  }

  // Low quality but we still have some classification — show as inconclusive with tips
  if (isLowQuality) {
    return "inconclusive";
  }

  if (confidence >= 0.5) {
    return "confident";
  }

  // Inconclusive: some signal but alternatives close or moderate confidence
  if (confidence >= 0.25) {
    return "inconclusive";
  }

  // Very low confidence — still show results as inconclusive rather than hiding them
  return "inconclusive";
}

/**
 * Build InputQuality from available signals (can be enriched over time).
 */
export function buildInputQuality(
  perKeypointVisibility?: Record<string, { mean: number; occludedPct: number }> | null,
  windowQualities?: number[],
): InputQuality {
  const reasonCodes: ReasonCode[] = [];
  let overall = 0.7; // default reasonable quality

  if (perKeypointVisibility) {
    const values = Object.values(perKeypointVisibility);
    const avgOcclusion = values.length > 0
      ? values.reduce((a, b) => a + b.occludedPct, 0) / values.length
      : 0;
    if (avgOcclusion > 0.4) {
      reasonCodes.push("Q_OUT_OF_FRAME");
      overall -= 0.3;
    }
  }

  if (windowQualities && windowQualities.length > 0) {
    const avgQuality = windowQualities.reduce((a, b) => a + b, 0) / windowQualities.length;
    if (avgQuality < 0.3) {
      overall -= 0.2;
    }
  }

  overall = Math.max(0, Math.min(1, overall));

  return {
    blurScore: 0.5, // placeholder until vision model provides
    cameraShake: 0.5,
    horseInFrame: overall > 0.5 ? 0.8 : 0.3,
    sideViewScore: 0.5,
    overall,
    reasonCodes,
  };
}

/**
 * Build a DecisionTrace for reproducibility tracking.
 */
export function buildDecisionTrace(
  analysisMode: string,
  criticUsed: boolean,
  windowSelectorUsed: boolean,
  breedPriorDelta?: number,
): DecisionTrace {
  const models = getAllModels();
  const modelVersions: Record<string, string> = {};
  for (const [task, entry] of Object.entries(models)) {
    modelVersions[task] = entry.model;
  }

  return {
    classifierVersion: getVersion(),
    rulesetHash: getRulesetHash(),
    criticUsed,
    windowSelectorUsed,
    modelVersions,
    analysisMode,
    breedPriorApplied: breedPriorDelta,
  };
}

/**
 * Build structured explainability: top reasons for & against the classification.
 */
export function buildExplainability(
  ctx: DecisionContext,
  result: DecisionResult,
): Explainability {
  const f = ctx.features;
  const evidenceFor: ExplainItem[] = [];
  const evidenceAgainst: ExplainItem[] = [];

  const cls = result.classification;

  // Evidence FOR
  if (f.beatEvenness > 0.7) {
    evidenceFor.push({ reason: "אחידות פעימות גבוהה (Beat Evenness)", metric: "beatEvenness", value: f.beatEvenness });
  }
  if (f.contactEventConfidence > 0.6) {
    evidenceFor.push({ reason: "ביטחון גבוה בזיהוי אירועי נחיתה", metric: "contactEventConfidence", value: f.contactEventConfidence });
  }
  if (cls === "lateral" && f.meanLateralLag < 50) {
    evidenceFor.push({ reason: "השהייה לטרלית נמוכה — עקביות פייס/טולט", metric: "meanLateralLag", value: f.meanLateralLag });
  }
  if (cls === "diagonal" && f.meanDiagonalLag < 50) {
    evidenceFor.push({ reason: "השהייה דיאגונלית נמוכה — תבנית טרוט ברורה", metric: "meanDiagonalLag", value: f.meanDiagonalLag });
  }
  if (cls === "four_beat" && f.beatEvenness > 0.8) {
    evidenceFor.push({ reason: "4 פעימות שוות — תבנית טולט/rack ברורה", metric: "beatEvenness", value: f.beatEvenness });
  }
  if (f.strideVariability < 15) {
    evidenceFor.push({ reason: "עקביות צעד גבוהה (CV נמוך)", metric: "strideVariability", value: f.strideVariability });
  }
  if (f.headPelvisStability < 20) {
    evidenceFor.push({ reason: "יציבות ראש-אגן טובה", metric: "headPelvisStability", value: f.headPelvisStability });
  }

  // Window vote support
  const totalVotes = Object.values(ctx.windowVotes).reduce((a, b) => a + b, 0);
  const classVotes = ctx.windowVotes[cls] ?? 0;
  if (totalVotes > 0 && classVotes / totalVotes > 0.6) {
    evidenceFor.push({ reason: `רוב חלונות הניתוח (${classVotes}/${totalVotes}) תומכים בסיווג`, metric: "windowVotes" });
  }

  // Evidence AGAINST
  if (f.strideVariability > 25) {
    evidenceAgainst.push({ reason: "שונות גבוהה בין צעדים — ייתכן מעבר בין מקצבים", metric: "strideVariability", value: f.strideVariability });
  }
  if (f.beatEvenness < 0.5) {
    evidenceAgainst.push({ reason: "אחידות פעימות נמוכה — קצב לא סדיר", metric: "beatEvenness", value: f.beatEvenness });
  }
  if (f.contactEventConfidence < 0.4) {
    evidenceAgainst.push({ reason: "ביטחון נמוך בזיהוי נחיתות — ייתכן הסתרה", metric: "contactEventConfidence", value: f.contactEventConfidence });
  }
  if (f.headPelvisStability > 35) {
    evidenceAgainst.push({ reason: "חוסר יציבות ראש-אגן — ייתכן שהסוס לא בקצב יציב", metric: "headPelvisStability", value: f.headPelvisStability });
  }

  // Include alt classification as counter-evidence
  const alts = result.alternatives;
  if (alts && alts.length > 0 && alts[0].score > 0.3) {
    evidenceAgainst.push({ reason: `חלופה חזקה: ${alts[0].classification} (${(alts[0].score * 100).toFixed(0)}%)`, metric: "alternative" });
  }

  return {
    evidenceFor: evidenceFor.slice(0, 3),
    evidenceAgainst: evidenceAgainst.slice(0, 2),
  };
}

/**
 * Deterministic triage: should we recommend vet review?
 * Based on objective signals — NOT LLM output.
 */
export function computeRequiresVetReview(params: {
  qualitySealLevel?: QualitySealLevel;
  decisionOutcome?: DecisionOutcome;
  agreementScoreOverall?: number;
  conflictSeverities?: ConflictSeverity[];
  limitations?: FusionLimitation[];
  conditionRiskLevels?: string[];
}): boolean {
  const { qualitySealLevel, decisionOutcome, agreementScoreOverall, conflictSeverities, limitations, conditionRiskLevels } = params;

  // Low quality seal
  if (qualitySealLevel === "none" || qualitySealLevel === "bronze") return true;

  // Inconclusive/unknown/recapture outcome
  if (decisionOutcome === "inconclusive" || decisionOutcome === "recapture" || decisionOutcome === "unknown") return true;

  // Low agreement between modalities
  if (agreementScoreOverall != null && agreementScoreOverall < 55) return true;

  // Any error-level conflict
  if (conflictSeverities?.includes("error")) return true;

  // No audio-video sync + high/critical condition risk
  if (limitations?.includes("NO_AUDIO_VIDEO_SYNC") && conditionRiskLevels?.some(r => r === "high" || r === "critical")) return true;

  return false;
}
