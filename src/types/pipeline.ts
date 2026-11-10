// Pipeline architecture types — Decision Layer separation

import type { GaitFeatureVector } from "@/types/biomech";

// ── Reason Code Enums ──
export type InputQualityCode = "Q_LOW_BLUR" | "Q_LOW_SHAKE" | "Q_OUT_OF_FRAME" | "Q_NOT_SIDE_VIEW";
export type WindowDropCode = "W_TOO_FEW_CONTACTS" | "W_LOW_CONTACT_CONF" | "W_HIGH_OCCLUSION" | "W_IRREGULAR_ORDER";
export type DecisionCode = "D_LOW_CONFIDENCE" | "D_ALTERNATIVES_CLOSE" | "D_CONFLICT_WINDOWS" | "D_RECAPTURE_NEEDED";
export type CriticCode = "C_CONTRADICT_EVENNESS" | "C_LAG_STD_HIGH" | "C_VARIABILITY_HIGH";
export type ReasonCode = InputQualityCode | WindowDropCode | DecisionCode | CriticCode;

// ── Decision Outcome ──
export type DecisionOutcome = "confident" | "inconclusive" | "unknown" | "recapture";

/** Input quality assessment */
export interface InputQuality {
  blurScore: number;
  cameraShake: number;
  horseInFrame: number;
  sideViewScore: number;
  overall: number;
  reasonCodes: ReasonCode[];
}

/** Per-window decision tracking */
export interface WindowDecisionResult {
  index: number;
  quality: number;
  selected: boolean;
  vote?: { type: string; score: number; confidence: number };
  dropReasonCodes?: ReasonCode[];
}

/** Everything the classifier needs, decoupled from raw metrics */
export interface DecisionContext {
  features: GaitFeatureVector;
  windowVotes: Record<string, number>;
  qualityWindows: number;
  totalWindows: number;
  audioGaitType?: string;
  visionGaitType?: string;
  visionConfidence: number;
  analysisMode: "vision" | "audio" | "both";
  breedId?: string;
  perKeypointVisibility?: Record<string, { mean: number; occludedPct: number }>;
  // v3 additions
  inputQuality?: InputQuality;
  windowResults?: WindowDecisionResult[];
}

/** The output of any classifier, separate from BiomechMetrics */
export interface DecisionResult {
  classification: string;
  confidence: number;
  alternatives: Array<{ classification: string; score: number }>;
  classificationReason: string;
  criticApproved: boolean;
  criticWarnings: string[];
  confidenceBeforeCritic: number;
  confidenceAfterCritic: number;
  decisionSource: "biomech_local" | "server_metrics" | "audio_only";
  // v3 additions
  outcome: DecisionOutcome;
  reasonCodes: ReasonCode[];
}

/** Decision Trace — versioned metadata for reproducibility */
export interface DecisionTrace {
  classifierVersion: string;
  rulesetHash: string;
  criticUsed: boolean;
  windowSelectorUsed: boolean;
  modelVersions: Record<string, string>;
  analysisMode: string;
  breedPriorApplied?: number;
  keypointsSource?: "pose_engine" | "llm" | "hybrid_repair";
  poseEngineMeanConfidence?: number;
}

/** Quality Seal computed fields */
export type QualitySealLevel = "gold" | "silver" | "bronze" | "none";

/** Credit tier definitions */
export type CreditTier = "free" | "pro" | "coach";

export interface UserCredits {
  remaining: number;
  total: number;
  tier: CreditTier;
  resetAt: string;
}

/** Cost table for analysis modes */
export const ANALYSIS_COSTS: Record<string, number> = {
  audio: 1,
  vision: 3,
  both: 5,
};

/** Evidence-based explainability */
export interface ExplainItem {
  reason: string;
  windowIndex?: number;
  metric?: string;
  value?: number;
}

export interface Explainability {
  evidenceFor: ExplainItem[];
  evidenceAgainst: ExplainItem[];
}

/** Ground truth label vote */
export interface LabelVote {
  id?: string;
  analysisId: string;
  clipId?: string;
  label: string;
  confidence: number;
  alternatives?: Array<{ label: string; confidence: number }>;
  tags?: string[];
  notes?: string;
  captureMeta?: {
    sideView?: boolean;
    riderPresent?: boolean;
    surface?: "arena" | "trail" | "road" | "unknown";
    lighting?: "good" | "ok" | "poor" | "unknown";
    speed?: "slow" | "moderate" | "fast" | "unknown";
  };
  annotatorId: string;
  annotatorRole: "user" | "coach" | "admin";
  createdAt?: string;
}

/** Consensus result */
export interface ConsensusResult {
  analysisId: string;
  finalLabel: string;
  method: "majority_vote" | "weighted_vote" | "expert_override";
  agreement: number;
  labelStats: Record<string, number>;
  stable: boolean;
}
