// Advanced metrics types — FEIF, Froude, Lameness, Performance

import type { KinematicMetrics, SuspensionAnalysis } from "@/types/gait-core";

export interface FEIFServerScores {
  beatClarity: number;
  tempoConsistency: number;
  slowToltQuality: number | null;
  fastToltQuality: number | null;
  paceQuality: number | null;
  competitionReadiness: { ready: boolean; level: string; description: string };
  warnings: string[];
}

export interface FroudeResult {
  value: number;
  interpretation: string;
  gaitZone: "walk" | "trot" | "gallop" | "transition";
}

export interface LamenessAssessment {
  hhoEstimate: number;
  lamenessGrade: number;
  aaepScale: string;
  disclaimer: string;
}

export interface FEIStandards {
  recoveryHeartRate: { estimated: boolean; withinLimits: boolean; description: string };
  enduranceReadiness: { score: number; level: string; description: string };
}

export interface OverallPerformance {
  score: number;
  level: "elite" | "advanced" | "intermediate" | "developing" | "beginner";
  breakdown: { sync: number; consistency: number; symmetry: number; beatClarity: number };
}

export interface AdvancedMetricsResult {
  kinematicMetrics: KinematicMetrics;
  suspensionAnalysis: SuspensionAnalysis;
  feifScores?: FEIFServerScores;
  froudeNumber?: FroudeResult;
  lamenessAssessment?: LamenessAssessment;
  feiStandards?: FEIStandards;
  overallPerformance?: OverallPerformance;
  processing_time_ms: number;
}
