/**
 * Golden output files — 10 canonical analysis outputs.
 * Used for regression testing: any pipeline change must produce
 * results that match these within tolerance.
 */
import type { GaitFeatureVector } from "@/types/biomech";
import type { DecisionResult } from "@/types/pipeline";

export interface GoldenCase {
  id: string;
  description: string;
  features: GaitFeatureVector;
  breedId?: string;
  tier: 1 | 2 | 3;
  expected: {
    classification: string;
    confidenceMin: number;
    confidenceMax: number;
    sealLevel?: "gold" | "silver" | "bronze" | "none";
    alternatives?: string[];
  };
}

export const goldenCases: GoldenCase[] = [
  {
    id: "G001",
    description: "Clean trot — Warmblood",
    features: {
      meanLateralLag: 88, stdLateralLag: 7,
      meanDiagonalLag: 14, stdDiagonalLag: 4,
      beatEvenness: 0.87, strideVariability: 5.5,
      headPelvisStability: 11, suspensionProxy: 0.052,
      contactEventConfidence: 0.8, footfallOrder: "LH-RF-RH-LF",
    },
    breedId: "warmblood",
    tier: 2,
    expected: { classification: "diagonal", confidenceMin: 0.35, confidenceMax: 1.0, alternatives: ["lateral"] },
  },
  {
    id: "G002",
    description: "Clean pace — Standardbred",
    features: {
      meanLateralLag: 8, stdLateralLag: 3,
      meanDiagonalLag: 100, stdDiagonalLag: 6,
      beatEvenness: 0.84, strideVariability: 6,
      headPelvisStability: 13, suspensionProxy: 0.04,
      contactEventConfidence: 0.77, footfallOrder: "LH-LF-RH-RF",
    },
    breedId: "standardbred",
    tier: 2,
    expected: { classification: "lateral", confidenceMin: 0.35, confidenceMax: 1.0, alternatives: ["diagonal"] },
  },
  {
    id: "G003",
    description: "Tölt — Icelandic",
    features: {
      meanLateralLag: 62, stdLateralLag: 5,
      meanDiagonalLag: 68, stdDiagonalLag: 5,
      beatEvenness: 0.9, strideVariability: 4,
      headPelvisStability: 8, suspensionProxy: 0.028,
      contactEventConfidence: 0.85, footfallOrder: "LH-LF-RH-RF",
    },
    breedId: "icelandic",
    tier: 2,
    expected: { classification: "four_beat", confidenceMin: 0.3, confidenceMax: 1.0, alternatives: ["singlefoot"] },
  },
  {
    id: "G004",
    description: "Running Walk — TWH",
    features: {
      meanLateralLag: 33, stdLateralLag: 9,
      meanDiagonalLag: 72, stdDiagonalLag: 11,
      beatEvenness: 0.7, strideVariability: 13,
      headPelvisStability: 20, suspensionProxy: 0.038,
      contactEventConfidence: 0.62, footfallOrder: "LH-LF-RH-RF",
    },
    breedId: "walking_horse",
    tier: 2,
    expected: { classification: "singlefoot", confidenceMin: 0.2, confidenceMax: 1.0, alternatives: ["four_beat"] },
  },
  {
    id: "G005",
    description: "Broken pace — Standardbred off-gait",
    features: {
      meanLateralLag: 35, stdLateralLag: 14,
      meanDiagonalLag: 78, stdDiagonalLag: 13,
      beatEvenness: 0.38, strideVariability: 24,
      headPelvisStability: 30, suspensionProxy: 0.055,
      contactEventConfidence: 0.52, footfallOrder: "LH-LF-RH-RF",
    },
    breedId: "standardbred",
    tier: 2,
    expected: { classification: "broken_pace", confidenceMin: 0.15, confidenceMax: 1.0, alternatives: ["singlefoot"] },
  },
  {
    id: "G006",
    description: "Ambiguous — no clear winner",
    features: {
      meanLateralLag: 15, stdLateralLag: 22,
      meanDiagonalLag: 16, stdDiagonalLag: 20,
      beatEvenness: 0.35, strideVariability: 28,
      headPelvisStability: 35, suspensionProxy: 0.02,
      contactEventConfidence: 0.3, footfallOrder: "unknown",
    },
    tier: 2,
    expected: { classification: "inconclusive", confidenceMin: 0.0, confidenceMax: 0.5, alternatives: [] },
  },
  {
    id: "G007",
    description: "Very poor data — low confidence inconclusive",
    features: {
      meanLateralLag: 3, stdLateralLag: 50,
      meanDiagonalLag: 4, stdDiagonalLag: 42,
      beatEvenness: 0.1, strideVariability: 65,
      headPelvisStability: 60, suspensionProxy: 0.005,
      contactEventConfidence: 0.03, footfallOrder: "unknown",
    },
    tier: 2,
    expected: { classification: "inconclusive", confidenceMin: 0.0, confidenceMax: 0.5, alternatives: [] },
  },
  {
    id: "G008",
    description: "High quality trot — Gold seal candidate",
    features: {
      meanLateralLag: 92, stdLateralLag: 5,
      meanDiagonalLag: 10, stdDiagonalLag: 3,
      beatEvenness: 0.92, strideVariability: 3.5,
      headPelvisStability: 8, suspensionProxy: 0.06,
      contactEventConfidence: 0.88, footfallOrder: "LH-RF-RH-LF",
    },
    tier: 2,
    expected: { classification: "diagonal", confidenceMin: 0.4, confidenceMax: 1.0, sealLevel: "gold", alternatives: [] },
  },
  {
    id: "G009",
    description: "Moderate quality — Silver seal",
    features: {
      meanLateralLag: 85, stdLateralLag: 12,
      meanDiagonalLag: 18, stdDiagonalLag: 8,
      beatEvenness: 0.72, strideVariability: 10,
      headPelvisStability: 18, suspensionProxy: 0.045,
      contactEventConfidence: 0.65, footfallOrder: "LH-RF-RH-LF",
    },
    tier: 2,
    expected: { classification: "diagonal", confidenceMin: 0.3, confidenceMax: 1.0, sealLevel: "silver", alternatives: [] },
  },
  {
    id: "G010",
    description: "Paso Fino — clean singlefoot with breed prior",
    features: {
      meanLateralLag: 38, stdLateralLag: 7,
      meanDiagonalLag: 70, stdDiagonalLag: 9,
      beatEvenness: 0.75, strideVariability: 11,
      headPelvisStability: 15, suspensionProxy: 0.032,
      contactEventConfidence: 0.7, footfallOrder: "LH-LF-RH-RF",
    },
    breedId: "paso_fino",
    tier: 2,
    expected: { classification: "singlefoot", confidenceMin: 0.2, confidenceMax: 1.0, alternatives: ["four_beat"] },
  },
];
