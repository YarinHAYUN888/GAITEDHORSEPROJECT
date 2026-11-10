/**
 * Biomechanics test fixtures — standard keypoint/feature scenarios.
 * Each fixture provides a GaitFeatureVector and expected classification.
 */
import type { GaitFeatureVector, BiomechFrame, HoofName, FootContactEvent } from "@/types/biomech";

// ── Feature vector fixtures ──

/** Clean trot: low diagonal lag, high lateral lag */
export const trotFeatures: GaitFeatureVector = {
  meanLateralLag: 90,
  stdLateralLag: 8,
  meanDiagonalLag: 12,
  stdDiagonalLag: 5,
  beatEvenness: 0.85,
  strideVariability: 6,
  headPelvisStability: 12,
  suspensionProxy: 0.05,
  contactEventConfidence: 0.78,
  footfallOrder: "LH-RF-RH-LF",
};

/** Clean pace: low lateral lag, high diagonal lag */
export const paceFeatures: GaitFeatureVector = {
  meanLateralLag: 10,
  stdLateralLag: 4,
  meanDiagonalLag: 95,
  stdDiagonalLag: 7,
  beatEvenness: 0.82,
  strideVariability: 7,
  headPelvisStability: 14,
  suspensionProxy: 0.04,
  contactEventConfidence: 0.75,
  footfallOrder: "LH-LF-RH-RF",
};

/** Four-beat / tölt: both lags high, ratio near 1, very even beats */
export const fourBeatFeatures: GaitFeatureVector = {
  meanLateralLag: 65,
  stdLateralLag: 6,
  meanDiagonalLag: 70,
  stdDiagonalLag: 6,
  beatEvenness: 0.88,
  strideVariability: 5,
  headPelvisStability: 10,
  suspensionProxy: 0.03,
  contactEventConfidence: 0.82,
  footfallOrder: "LH-LF-RH-RF",
};

/** Singlefoot / running walk: both lags moderate, ratio < 0.7 */
export const singlefootFeatures: GaitFeatureVector = {
  meanLateralLag: 35,
  stdLateralLag: 8,
  meanDiagonalLag: 75,
  stdDiagonalLag: 10,
  beatEvenness: 0.72,
  strideVariability: 12,
  headPelvisStability: 18,
  suspensionProxy: 0.04,
  contactEventConfidence: 0.65,
  footfallOrder: "LH-LF-RH-RF",
};

/** Broken pace: ratio < 0.7 + low evenness */
export const brokenPaceFeatures: GaitFeatureVector = {
  meanLateralLag: 25,
  stdLateralLag: 15,
  meanDiagonalLag: 80,
  stdDiagonalLag: 12,
  beatEvenness: 0.42,
  strideVariability: 22,
  headPelvisStability: 28,
  suspensionProxy: 0.06,
  contactEventConfidence: 0.55,
  footfallOrder: "LH-LF-RH-RF",
};

/** Ambiguous / inconclusive: two competing scores very close */
export const inconclusiveFeatures: GaitFeatureVector = {
  meanLateralLag: 40,
  stdLateralLag: 20,
  meanDiagonalLag: 42,
  stdDiagonalLag: 18,
  beatEvenness: 0.48,
  strideVariability: 18,
  headPelvisStability: 25,
  suspensionProxy: 0.035,
  contactEventConfidence: 0.42,
  footfallOrder: "unknown",
};

/** Very poor data → unknown */
export const unknownFeatures: GaitFeatureVector = {
  meanLateralLag: 5,
  stdLateralLag: 40,
  meanDiagonalLag: 5,
  stdDiagonalLag: 38,
  beatEvenness: 0.15,
  strideVariability: 45,
  headPelvisStability: 55,
  suspensionProxy: 0.01,
  contactEventConfidence: 0.18,
  footfallOrder: "unknown",
};

/** Missing one hind leg entirely */
export const missingLegFeatures: GaitFeatureVector = {
  meanLateralLag: 0,
  stdLateralLag: 0,
  meanDiagonalLag: 20,
  stdDiagonalLag: 15,
  beatEvenness: 0.3,
  strideVariability: 35,
  headPelvisStability: 40,
  suspensionProxy: 0.02,
  contactEventConfidence: 0.25,
  footfallOrder: "unknown",
};

// ── Frame fixtures ──

function makePoint(x: number, y: number): [number, number] {
  return [x, y];
}

/** Generate synthetic frames simulating a trot at given FPS */
export function generateTrotFrames(fps: number, durationSec: number): BiomechFrame[] {
  const frames: BiomechFrame[] = [];
  const n = Math.round(fps * durationSec);
  const strideHz = 1.4; // ~1.4 strides/sec at trot

  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const phase = (t * strideHz * 2 * Math.PI);
    // Diagonal pairs move together
    const lfY = 0.5 + 0.1 * Math.sin(phase);
    const rhY = 0.5 + 0.1 * Math.sin(phase); // in phase with LF
    const rfY = 0.5 + 0.1 * Math.sin(phase + Math.PI);
    const lhY = 0.5 + 0.1 * Math.sin(phase + Math.PI); // in phase with RF

    frames.push({
      t,
      points: {
        lf_hoof: makePoint(0.2, lfY),
        rf_hoof: makePoint(0.8, rfY),
        lh_hoof: makePoint(0.2, lhY),
        rh_hoof: makePoint(0.8, rhY),
        lf_fetlock: makePoint(0.2, lfY - 0.05),
        rf_fetlock: makePoint(0.8, rfY - 0.05),
        lh_fetlock: makePoint(0.2, lhY - 0.05),
        rh_fetlock: makePoint(0.8, rhY - 0.05),
        poll: makePoint(0.3, 0.2 + 0.02 * Math.sin(phase * 2)),
        dock: makePoint(0.7, 0.3 + 0.01 * Math.sin(phase * 2)),
        withers: makePoint(0.4, 0.25),
        croup: makePoint(0.6, 0.28),
      },
    });
  }
  return frames;
}

/** Generate frames with very low FPS (e.g., 8 fps) */
export function generateLowFPSFrames(): BiomechFrame[] {
  return generateTrotFrames(8, 4);
}

/** Generate frames with 50% missing hoof keypoints */
export function generateOccludedFrames(fps: number, durationSec: number): BiomechFrame[] {
  const frames = generateTrotFrames(fps, durationSec);
  // Remove hoof points from ~50% of frames
  for (let i = 0; i < frames.length; i++) {
    if (i % 2 === 0) {
      delete frames[i].points.lh_hoof;
      delete frames[i].points.rh_hoof;
    }
  }
  return frames;
}
