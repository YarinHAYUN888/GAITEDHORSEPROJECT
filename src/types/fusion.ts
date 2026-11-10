// Cross-modal fusion types

export type FusionLevel = "summary" | "event_aligned";
export type FusionLimitation = "NO_AUDIO_VIDEO_SYNC" | "LOW_FPS" | "LOW_LIGHT" | "HIGH_OCCLUSION";
export type FusionSource = "biomech" | "vision" | "audio" | "keypoints" | "weighted_avg" | "rule_based";
export type ConflictSeverity = "info" | "warning" | "error";
export type ConflictActionHint = "none" | "lower_confidence" | "inconclusive" | "recapture";
export type ConflictReasonCode =
  | "AUDIO_4BEAT_BUT_CONTACTS_UNSTABLE"
  | "VISION_TROT_BUT_AUDIO_PACE"
  | "KEYPOINTS_LOW_CONFIDENCE"
  | "WINDOWS_DISAGREE_HIGH_ENTROPY"
  | "RHYTHM_UNSTABLE"
  | "SYNC_NOT_AVAILABLE"
  | "SYMMETRY_MISMATCH"
  | "BPM_MISMATCH";

export interface FusionConflict {
  code: ConflictReasonCode;
  severity: ConflictSeverity;
  actionHint: ConflictActionHint;
  details?: string;
}

export interface AgreementBreakdown {
  gaitType: number;
  rhythm: number;
  symmetry: number;
  contacts: number;
}

export interface FusionVersioning {
  fusionRulesetHash: string;
  inputsUsed: {
    visionModelVersion?: string;
    keypointsModelVersion?: string;
    decisionEngineVersion?: string;
    criticModelVersion?: string;
  };
}

export interface MultiModalFusion {
  visionGaitType: string;
  audioGaitType: string | null;
  agreement: boolean;
  conflictDescription: string;
  fusedConfidence: number;
  dominantModality: "vision" | "audio" | "both";
  // v2 additions
  fusionLevel?: FusionLevel;
  limitations?: FusionLimitation[];
  agreementScoreOverall?: number;
  agreementBreakdown?: AgreementBreakdown;
  conflictReasonCodes?: ConflictReasonCode[];
  conflicts?: FusionConflict[];
  provenance?: Record<string, FusionSource>;
  versioning?: FusionVersioning;
}
