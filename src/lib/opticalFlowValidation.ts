/**
 * Optical Flow Validation — Camera motion detection from keypoint trajectories.
 *
 * Without pixel-level optical flow, we estimate camera artifacts by analyzing
 * the *global* motion of all tracked keypoints. If all points translate coherently,
 * we infer camera panning. Rotational coherence → circular/arc motion.
 *
 * References:
 * [6] PFERD dataset (Nature Scientific Data)
 * [7] EKGA pipeline (Niknejad et al., ASABE)
 */

import type { BiomechFrame, Point2 } from "@/types/biomech";
import { isFinitePoint, mean, stdev } from "./biomechanics";

// ── Types ──

export interface CameraMotionMetrics {
  /** Global translation per frame (mean across all keypoints), normalized units/s */
  globalTranslationSpeed: number;
  /** Fraction of frames where global coherence > 0.85 (likely panning) */
  panningFraction: number;
  /** Whether significant panning was detected (>30% of frames) */
  panningDetected: boolean;
  /** Mean angular velocity of all keypoints around centroid (deg/s) — high = circular motion */
  angularVelocityDegS: number;
  /** Whether circular/arc motion detected */
  circularMotionDetected: boolean;
  /** Estimated horse ground speed (body-lengths/s) from withers-dock displacement */
  estimatedSpeedBLS: number;
  /** Quality score 0..1 — higher = less camera artifact, better for analysis */
  cameraStabilityScore: number;
  /** Human-readable warnings */
  warnings: string[];
  /** Per-frame global coherence (for timeline visualization) */
  perFrameCoherence?: number[];
}

// ── Helpers ──

function frameKeypoints(frame: BiomechFrame): Point2[] {
  const pts: Point2[] = [];
  for (const p of Object.values(frame.points)) {
    if (isFinitePoint(p)) pts.push(p);
  }
  return pts;
}

function centroid(pts: Point2[]): Point2 {
  if (!pts.length) return [0, 0];
  const sx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const sy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [sx, sy];
}

/**
 * Compute per-keypoint displacement vectors between two frames.
 * Returns only keypoints visible in both frames.
 */
function pairedDisplacements(
  f0: BiomechFrame,
  f1: BiomechFrame,
): { key: string; dx: number; dy: number }[] {
  const pairs: { key: string; dx: number; dy: number }[] = [];
  for (const key of Object.keys(f0.points)) {
    const p0 = f0.points[key];
    const p1 = f1.points[key];
    if (isFinitePoint(p0) && isFinitePoint(p1)) {
      pairs.push({ key, dx: p1[0] - p0[0], dy: p1[1] - p0[1] });
    }
  }
  return pairs;
}

/**
 * Coherence: how much do all keypoints move in the same direction?
 * 1.0 = perfect panning (all displacements parallel), 0.0 = random.
 * Uses the magnitude of the mean displacement vector vs mean of magnitudes.
 */
function translationCoherence(displacements: { dx: number; dy: number }[]): number {
  if (displacements.length < 3) return 0;
  const meanDx = displacements.reduce((s, d) => s + d.dx, 0) / displacements.length;
  const meanDy = displacements.reduce((s, d) => s + d.dy, 0) / displacements.length;
  const meanVecMag = Math.sqrt(meanDx * meanDx + meanDy * meanDy);
  const meanMag = displacements.reduce((s, d) => s + Math.sqrt(d.dx * d.dx + d.dy * d.dy), 0) / displacements.length;
  if (meanMag < 1e-6) return 0;
  return meanVecMag / meanMag; // 0..1
}

/**
 * Compute angular velocity around centroid between two frames.
 * Returns mean angular change in degrees.
 */
function angularChange(f0: BiomechFrame, f1: BiomechFrame): number {
  const pts0 = frameKeypoints(f0);
  const pts1 = frameKeypoints(f1);
  if (pts0.length < 3 || pts1.length < 3) return 0;

  const c0 = centroid(pts0);
  const c1 = centroid(pts1);

  // Match keypoints visible in both
  const angles: number[] = [];
  for (const key of Object.keys(f0.points)) {
    const p0 = f0.points[key];
    const p1 = f1.points[key];
    if (!isFinitePoint(p0) || !isFinitePoint(p1)) continue;

    const a0 = Math.atan2(p0[1] - c0[1], p0[0] - c0[0]);
    const a1 = Math.atan2(p1[1] - c1[1], p1[0] - c1[0]);
    let da = (a1 - a0) * (180 / Math.PI);
    // Normalize to [-180, 180]
    while (da > 180) da -= 360;
    while (da < -180) da += 360;
    angles.push(da);
  }

  if (!angles.length) return 0;
  return angles.reduce((s, a) => s + a, 0) / angles.length;
}

/**
 * Estimate horse body length from withers-to-dock distance (median across frames).
 */
function estimateBodyLength(frames: BiomechFrame[]): number {
  const lengths: number[] = [];
  for (const f of frames) {
    const w = f.points["withers"];
    const d = f.points["dock"];
    if (isFinitePoint(w) && isFinitePoint(d)) {
      lengths.push(Math.sqrt((w[0] - d[0]) ** 2 + (w[1] - d[1]) ** 2));
    }
  }
  if (!lengths.length) return 0.2; // fallback
  lengths.sort((a, b) => a - b);
  return lengths[Math.floor(lengths.length / 2)]; // median
}

// ── Main export ──

/**
 * Analyze camera motion from keypoint trajectories.
 * Should be called AFTER smoothing.
 */
export function analyzeCameraMotion(
  frames: BiomechFrame[],
  fps: number,
): CameraMotionMetrics {
  const warnings: string[] = [];
  const dt = 1 / fps;

  if (frames.length < 5) {
    return {
      globalTranslationSpeed: 0,
      panningFraction: 0,
      panningDetected: false,
      angularVelocityDegS: 0,
      circularMotionDetected: false,
      estimatedSpeedBLS: 0,
      cameraStabilityScore: 0.5,
      warnings: ["too_few_frames"],
    };
  }

  const bodyLen = estimateBodyLength(frames);

  // Per-frame metrics
  const coherences: number[] = [];
  const translationSpeeds: number[] = [];
  const angularSpeeds: number[] = [];
  const centroidSpeeds: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const disps = pairedDisplacements(frames[i - 1], frames[i]);
    if (disps.length < 3) {
      coherences.push(0);
      translationSpeeds.push(0);
      angularSpeeds.push(0);
      centroidSpeeds.push(0);
      continue;
    }

    // Translation coherence
    const coh = translationCoherence(disps);
    coherences.push(coh);

    // Mean global translation speed
    const meanDx = disps.reduce((s, d) => s + d.dx, 0) / disps.length;
    const meanDy = disps.reduce((s, d) => s + d.dy, 0) / disps.length;
    const globalSpeed = Math.sqrt(meanDx * meanDx + meanDy * meanDy) / dt;
    translationSpeeds.push(globalSpeed);

    // Angular velocity
    const angDeg = angularChange(frames[i - 1], frames[i]);
    angularSpeeds.push(Math.abs(angDeg) / dt);

    // Centroid displacement (for horse speed)
    const c0 = centroid(frameKeypoints(frames[i - 1]));
    const c1 = centroid(frameKeypoints(frames[i]));
    const cdist = Math.sqrt((c1[0] - c0[0]) ** 2 + (c1[1] - c0[1]) ** 2);
    centroidSpeeds.push(cdist / dt);
  }

  // Aggregate
  const meanTranslation = mean(translationSpeeds) ?? 0;
  const panningCount = coherences.filter(c => c > 0.85).length;
  const panningFraction = coherences.length > 0 ? panningCount / coherences.length : 0;
  const panningDetected = panningFraction > 0.3;

  const meanAngularSpeed = mean(angularSpeeds) ?? 0;
  const circularMotionDetected = meanAngularSpeed > 15; // >15 deg/s

  // Horse speed in body-lengths/s (subtract camera translation if panning)
  const rawCentroidSpeed = mean(centroidSpeeds) ?? 0;
  const horseSpeed = bodyLen > 0.01 ? rawCentroidSpeed / bodyLen : 0;

  // Camera stability score
  let stability = 1.0;
  if (panningDetected) stability -= 0.3;
  if (circularMotionDetected) stability -= 0.3;
  // High coherence variance = shaky camera
  const cohStd = stdev(coherences) ?? 0;
  if (cohStd > 0.3) stability -= 0.2;
  stability = Math.max(0, Math.min(1, stability));

  // Warnings
  if (panningDetected) {
    warnings.push("camera_panning");
  }
  if (circularMotionDetected) {
    warnings.push("circular_motion");
  }
  if (cohStd > 0.3) {
    warnings.push("shaky_camera");
  }
  if (meanTranslation > 0.5) {
    warnings.push("fast_camera_movement");
  }

  return {
    globalTranslationSpeed: Math.round(meanTranslation * 1000) / 1000,
    panningFraction: Math.round(panningFraction * 100) / 100,
    panningDetected,
    angularVelocityDegS: Math.round(meanAngularSpeed * 10) / 10,
    circularMotionDetected,
    estimatedSpeedBLS: Math.round(horseSpeed * 100) / 100,
    cameraStabilityScore: Math.round(stability * 100) / 100,
    warnings,
    perFrameCoherence: coherences,
  };
}
