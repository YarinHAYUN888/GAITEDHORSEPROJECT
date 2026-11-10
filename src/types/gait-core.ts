// Core gait analysis types — kinematics, suspension, audio, keypoints

import type { PhaseLagMs, DiagonalDissociationMs, HeadPelvisMetrics, BackMetrics, BiomechMetrics } from "@/types/biomech";

export interface KinematicMetrics {
  strideLength?: { left: number; right: number; asymmetryPercent: number };
  stanceDuration?: { FL: number; FR: number; HL: number; HR: number };
  swingDuration?: { FL: number; FR: number; HL: number; HR: number };
  jointAngles?: {
    frontLeft?: { shoulder: number; carpus: number; fetlock: number };
    frontRight?: { shoulder: number; carpus: number; fetlock: number };
    hindLeft?: { hip: number; stifle: number; fetlock: number };
    hindRight?: { hip: number; stifle: number; fetlock: number };
  };
  legLiftHeight?: { FL: number; FR: number; HL: number; HR: number };
  overreachDistance?: number | null;
  phaseLagMs?: PhaseLagMs;
  diagonalDissociationMs?: DiagonalDissociationMs;
}

export interface SuspensionAnalysis {
  FL?: { airTimeMs: number; groundTimeMs: number; ratio: number; liftoffFrame?: number; touchdownFrame?: number };
  FR?: { airTimeMs: number; groundTimeMs: number; ratio: number; liftoffFrame?: number; touchdownFrame?: number };
  HL?: { airTimeMs: number; groundTimeMs: number; ratio: number; liftoffFrame?: number; touchdownFrame?: number };
  HR?: { airTimeMs: number; groundTimeMs: number; ratio: number; liftoffFrame?: number; touchdownFrame?: number };
  asymmetryAlerts?: string[];
}

export interface AudioAnalysis {
  detectedBPM: number;
  rhythmRegularity: number;
  beatPattern: string;
  weakBeatDetected: boolean;
  weakBeatDescription?: string;
  audioGaitClassification: string;
  audioConfidence: number;
  beatsPerStrideCycle?: number;
  impactIntensityVariation?: number;
  acousticAsymmetry?: number;
  contactFlightRatio?: number;
}

export interface CrossModalValidation {
  expectedGaitType: string | null;
  audioGaitType: string;
  gaitAgreement: boolean;
  visionAudioMatch: number;
  reliabilityScore: number;
  brokenGaitDetected: boolean;
  validationFlags: string[];
}

export interface AudioMetrics {
  bpm: number;
  regularity: number;
  beatCount: number;
  hasWeakBeat: boolean;
  peakAmplitudes: number[];
  dominantFrequencies?: number[];
  dragNoiseDetected?: boolean;
  surfaceType?: string;
  signalToNoiseRatio?: number;
}

// BiomechanicalOverlay types
export interface Keypoint {
  hoof?: [number, number];
  fetlock?: [number, number];
  carpus?: [number, number];
  shoulder?: [number, number];
  stifle?: [number, number];
  hip?: [number, number];
}

export interface KeypointsData {
  detected: boolean;
  frontLeft?: Keypoint;
  frontRight?: Keypoint;
  hindLeft?: Keypoint;
  hindRight?: Keypoint;
}

export interface JointIssue {
  leg: string;
  joint: string;
  value: number;
  normal: [number, number];
}

export interface SuspensionData {
  FL?: { airTimeMs: number; groundTimeMs: number; ratio: number };
  FR?: { airTimeMs: number; groundTimeMs: number; ratio: number };
  HL?: { airTimeMs: number; groundTimeMs: number; ratio: number };
  HR?: { airTimeMs: number; groundTimeMs: number; ratio: number };
  asymmetryAlerts?: string[];
}

export interface GaitAnalysisResult {
  gaitType: string;
  gaitTypeHebrew: string;
  confidence: number;
  beatPattern: string;
  lateralSync: { percentage: number; description: string };
  symmetry: {
    score: number;
    leftRightDifference: number;
    lamenessRisk: string;
    lamenessDescription: string;
  };
  extension: {
    frontLegs: number;
    hindLegs: number;
    quality: string;
    description: string;
  };
  keypoints: { detected: boolean; [key: string]: any };
  beatTracker: {
    impactTimes: Array<{ leg: string; frameIndex: number; phase: string }>;
    offsetPercentage: number;
    isDirty: boolean;
    dirtyDescription: string;
  };
  overallScore: number;
  trainingRecommendations: (string | { title: string; description?: string })[];
  summary: string;
  breedSpecificNotes?: string;
  goalFocusedSummary?: string;
  horseName?: string;
  kinematicMetrics?: KinematicMetrics;
  suspensionAnalysis?: SuspensionAnalysis;
  audioAnalysis?: AudioAnalysis;
  multiModalFusion?: import("@/types/fusion").MultiModalFusion;
  biomechMetrics?: BiomechMetrics;
  headPelvisMetrics?: HeadPelvisMetrics;
  backMetrics?: BackMetrics;
}
