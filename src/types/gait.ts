// Barrel re-export — maintains backward compatibility
// All consumers can continue importing from "@/types/gait"

// Core types
export type {
  KinematicMetrics,
  SuspensionAnalysis,
  AudioAnalysis,
  CrossModalValidation,
  AudioMetrics,
  Keypoint,
  KeypointsData,
  JointIssue,
  SuspensionData,
  GaitAnalysisResult,
} from "@/types/gait-core";

// Fusion types
export type {
  FusionLevel,
  FusionLimitation,
  FusionSource,
  ConflictSeverity,
  ConflictActionHint,
  ConflictReasonCode,
  FusionConflict,
  AgreementBreakdown,
  FusionVersioning,
  MultiModalFusion,
} from "@/types/fusion";

// Condition types
export type {
  ConditionRiskScreening,
  EvidenceItem,
  DetectConditionsResult,
} from "@/types/conditions";

// Advanced metrics types
export type {
  FEIFServerScores,
  FroudeResult,
  LamenessAssessment,
  FEIStandards,
  OverallPerformance,
  AdvancedMetricsResult,
} from "@/types/advanced-metrics";

// Enriched result
export type { EnrichedGaitResult } from "@/types/enriched-result";

// Re-export biomech types that were previously re-exported here
export type {
  BiomechMetrics,
  PhaseLagMs,
  DiagonalDissociationMs,
  HeadPelvisMetrics,
  BackMetrics,
  GaitFeatureVector,
  FootContactEvent,
  GaitWindow,
  WindowQualityMetrics,
  WindowSelectorResult,
  ConsistencyCriticResult,
  LabelFeedbackResult,
  OcclusionAggregates,
  OcclusionNote,
} from "@/types/biomech";
