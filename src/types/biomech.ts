// Biomechanics types — research-backed metrics
// References:
// [1] DMRT3 inter-limb coordination (Nature 2012)
// [2] Back/pelvis kinematics (van Weeren)
// [3] Head/pelvis vertical symmetry (Rhodin / PLOS)
// [4] Timing paper (Animals 2022)
// [5] Diagonal dissociation (Hobbs 2016)
// [6] PFERD dataset (Nature Scientific Data)
// [7] EKGA pipeline (Niknejad et al., ASABE)

export type Point2 = [number, number];

export interface BiomechFrame {
  t: number; // seconds
  points: Record<string, Point2 | undefined>;
  conf?: Record<string, number | undefined>;
  smoothed?: boolean; // true after post-processing
  constraintViolations?: string[]; // anatomical violations detected
}

export interface BiomechInputSequence {
  fps: number;
  frames: BiomechFrame[];
}

export type HoofName = "lf_hoof" | "rf_hoof" | "lh_hoof" | "rh_hoof";

export interface PhaseLagMs {
  lf_rh?: number; // diagonal pair
  rf_lh?: number; // diagonal pair
  lf_lh?: number; // left lateral pair
  rf_rh?: number; // right lateral pair
}

export interface DiagonalDissociationMs {
  lf_rh?: number;
  rf_lh?: number;
}

export interface HeadPelvisMetrics {
  headVerticalROM?: number;
  pelvisVerticalROM?: number;
  headPelvisPhaseLagMs?: number;
  headVerticalAsymmetryIndex?: number; // 0 = symmetric
  // VSI — Vertical Symmetry Index (Rhodin et al.)
  headVSI?: number;       // HDmax-HDmin / (HDmax+HDmin) × 100
  pelvisVSI?: number;     // PDmax-PDmin / (PDmax+PDmin) × 100
  lamenessGrade?: number; // AAEP 0-5
  lamenessLeg?: "front" | "hind" | "both" | null;
  vsiReliable?: boolean;  // enough strides for reliable VSI
}

export interface BackMetrics {
  withersCroupROM?: number;
  backSlopeROM?: number;
  lateralSwayIndex?: number;
}

export interface GaitClassification {
  classification: "unknown" | "inconclusive" | "diagonal" | "lateral" | "four_beat" | "singlefoot" | "broken_pace";
  confidence: number; // 0..1
  strideFrequencyHz?: number;
  windowVotes?: Record<string, number>;
  totalWindows?: number;
  qualityWindows?: number;
  alternatives?: Array<{ classification: string; score: number }>;
  classificationReason?: string;
  breedPriorDelta?: number; // confidence adjustment from breed/DMRT3 prior
}

export interface FootContactEvent {
  hoofName: HoofName;
  frameIndex: number;
  t: number;
  confidence: number; // 0..1 based on velocity + position clarity
}

export interface GaitFeatureVector {
  meanLateralLag: number;
  stdLateralLag: number;
  meanDiagonalLag: number;
  stdDiagonalLag: number;
  beatEvenness: number;         // 0..1, how equal are inter-beat intervals
  strideVariability: number;    // CV% stride-to-stride
  headPelvisStability: number;  // CV% of head-pelvis phase lag
  suspensionProxy: number;      // avg vertical velocity at mid-stride
  contactEventConfidence: number; // mean confidence of detected contacts
  footfallOrder: string;        // e.g. "LH-LF-RH-RF"
}

export interface GaitWindow {
  startFrame: number;
  endFrame: number;
  startT: number;
  endT: number;
  features: GaitFeatureVector;
  classification: GaitClassification;
  quality: number; // 0..1 — window usability
}

export interface StrideRegularity {
  perLeg: Record<string, number>; // CV% per leg
  overall: number; // average CV%
  rating: "stable" | "moderate" | "irregular"; // <10% / 10-15% / >15%
}

export interface BiomechQuality {
  frames: number;
  fps: number;
  missingRate: Record<string, number>;
}

// Spinal metrics — whole-body analysis (CT skeletal model paper)
export interface SpinalMetrics {
  vertebraeCount: number; // typically 22 thoracic-lumbar
  flexionExtensionROM?: number; // degrees
  lateralRotationDeg?: number; // degrees
  couplingRatio?: number; // flexion-to-lateral coupling
  ribCageExpansionIndex?: number; // 0..1
  stressZones?: { vertebraIndex: number; stressLevel: number }[]; // 0..1 per vertebra
}

export interface ForceVector {
  legName: string;
  magnitude: number; // normalized 0..1
  directionDeg: number; // angle from vertical
  phase: number; // 0..1 gait cycle position
}

export interface LimbGRF {
  limb: HoofName;
  peakImpact: number;
  meanStanceLoad: number;
  peakTimingNorm: number;
  loadingRate: number;
  contactCount: number;
}

export interface GRFMetrics {
  perLimb: Record<HoofName, LimbGRF>;
  frontHindRatio: number;
  leftRightAsymmetry: number;
  overallPeakForce: number;
  overloadDetected: boolean;
  overloadedLimbs: HoofName[];
  reliable: boolean;
  warnings: string[];
}

export interface PostureData {
  id: string;
  nameHe: string;
  nameEn: string;
  description: string;
  isHealthy: boolean;
  spinalRotationDeg: number;
  limbLoading: Record<string, number>; // leg -> load factor 0..1
  stressedJoints: string[];
}

export interface CameraMotionMetrics {
  globalTranslationSpeed: number;
  panningFraction: number;
  panningDetected: boolean;
  angularVelocityDegS: number;
  circularMotionDetected: boolean;
  estimatedSpeedBLS: number;
  cameraStabilityScore: number;
  warnings: string[];
  perFrameCoherence?: number[];
}

export interface BiomechMetrics {
  quality: BiomechQuality;
  gait: GaitClassification;
  keypointsSource?: "pose_engine" | "llm" | "hybrid_repair";
  timing: {
    phaseLagMs?: PhaseLagMs;
    diagonalDissociationMs?: DiagonalDissociationMs;
  };
  headPelvis: HeadPelvisMetrics;
  back: BackMetrics;
  strideRegularity?: StrideRegularity;
  spinal?: SpinalMetrics;
  forceVectors?: ForceVector[];
  contactEvents?: Record<HoofName, FootContactEvent[]>;
  windows?: GaitWindow[];
  hoofPhases?: HoofPhaseSequence;
  stanceSwingMetrics?: StanceSwingMetrics;
  validationReport?: ValidationReport;
  cameraMotion?: CameraMotionMetrics;
  grfMetrics?: GRFMetrics;
}

// --- Hoof Phase Detection types (stance/swing/occluded) [7] ---

export type HoofPhaseLabel = "stance" | "swing" | "occluded";

export interface HoofPhaseEvent {
  hoofName: HoofName;
  frameIndex: number;
  t: number;
  phase: HoofPhaseLabel;
  confidence: number; // 0..1
}

export interface HoofPhaseSequence {
  events: HoofPhaseEvent[];
  perHoof: Record<HoofName, HoofPhaseLabel[]>; // per-frame phase label
}

export interface StanceSwingMetrics {
  perHoof: Record<HoofName, {
    stanceDurationMs: number;
    swingDurationMs: number;
    dutyFactor: number; // stance / (stance + swing), 0..1
    occludedPct: number; // % of frames occluded
  }>;
  overallDutyFactor: number;
}

// --- Window Quality extended with motion signals [6][7] ---

export interface WindowQualityMetrics {
  index: number;
  missingPct: number;
  blurProxy: number;
  cameraMotion: number;
  horseStability: number;
  motionEnergy?: number;     // sum of velocity magnitudes across all keypoints
  hoofActivityRate?: number; // % of frames with hoof movement > threshold
}

// --- Validation / KPI types [7] ---

export interface ValidationReport {
  interWindowAgreement: number;     // 0..1 — fraction of windows agreeing on classification
  contactConsistencyRMSE: number;   // RMSE of stride intervals across windows (ms)
  keypointTemporalStability: number; // mean frame-to-frame displacement per keypoint
  anatomicalViolationRate: number;  // 0..1 — fraction of frames with constraint violations
  blandAltmanBias: number;          // mean diff between first/second half metrics
  blandAltmanLoA: number;           // limits of agreement (1.96 * SD)
  overallQualityScore: number;      // composite 0..100
}

// --- LLM Agent types ---

export interface OcclusionAggregates {
  [keypointName: string]: {
    mean: number;
    occludedPct: number;
  };
}

export interface OcclusionNote {
  windowIndex: number;
  keypoint: string;
  note: string;
}

export type WindowReasonCode =
  | "REJECT_BLUR"
  | "REJECT_SHAKE"
  | "REJECT_OCCLUSION"
  | "REJECT_OUT_OF_FRAME"
  | "REJECT_TURNING"
  | "REJECT_SPEED_CHANGE";

export interface WindowSelectorResult {
  selected: Array<{ index: number; score: number; reason: string }>;
  rejected: Array<{ index: number; reasonCodes: WindowReasonCode[] }>;
  abstain: boolean;
  abstainReason?: string;
  needsVisual: boolean;
  coverageHint: "spread" | "clustered";
}

export interface ConsistencyCriticResult {
  approved: boolean;
  confidenceAdjustment: number; // 0.5..1.2
  alternatives: Array<{ classification: string; score: number }>;
  reasonCodes: string[];
  contradictions: Array<{ metric: string; observed: number; expectedRange: string }>;
}

export type FeedbackTag =
  | "irregular_beat"
  | "high_variability"
  | "pace_tendency"
  | "diagonal_dominant"
  | "low_confidence_keypoints"
  | "occlusion_issue"
  | "camera_instability"
  | "OTHER";

export interface LabelFeedbackResult {
  tags: FeedbackTag[];
  evidence: Array<{ feature: string; direction: "high" | "low"; value?: number }>;
  summary: string;
  suggestions: Array<{
    metric: string;
    action: "increase_min" | "decrease_max" | "widen_range";
    delta: number;
    confidence: number;
  }>;
}

// --- Dense frame extraction result ---

export interface DenseExtractionResult {
  frames: string[]; // base64 JPEG
  effectiveFps: number;
  startSec: number;
  endSec: number;
  totalExtracted: number;
}
