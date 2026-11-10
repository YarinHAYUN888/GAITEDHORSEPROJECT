/**
 * Biomechanics feature extraction for gaited horses.
 *
 * References:
 * [1] DMRT3 inter-limb coordination (Nature 2012)
 * [2] Back/pelvis kinematics (van Weeren)
 * [3] Head/pelvis vertical symmetry (Rhodin / PLOS)
 * [5] Diagonal dissociation (Hobbs 2016)
 */

import type {
  Point2,
  BiomechFrame,
  BiomechInputSequence,
  BiomechMetrics,
  BiomechQuality,
  GaitClassification,
  PhaseLagMs,
  DiagonalDissociationMs,
  HeadPelvisMetrics,
  BackMetrics,
  HoofName,
  StrideRegularity,
  FootContactEvent,
  GaitFeatureVector,
  GaitWindow,
  WindowQualityMetrics,
  HoofPhaseLabel,
  HoofPhaseEvent,
  HoofPhaseSequence,
  StanceSwingMetrics,
} from "@/types/biomech";
import type { KeypointsData } from "@/types/gait";
import { analyzeCameraMotion } from "./opticalFlowValidation";
import { estimateGRF } from "./grfEstimation";

// ── Utilities ──

export function isFinitePoint(p?: Point2): p is Point2 {
  return !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

export function mean(arr: number[]): number | undefined {
  const a = arr.filter(Number.isFinite);
  if (!a.length) return undefined;
  return a.reduce((s, v) => s + v, 0) / a.length;
}

export function stdev(arr: number[]): number | undefined {
  const m = mean(arr);
  if (m === undefined) return undefined;
  const a = arr.filter(Number.isFinite);
  if (a.length < 2) return undefined;
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
  return Math.sqrt(v);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Simple moving average */
export function sma(values: (number | undefined)[], win: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  const w = Math.max(1, Math.floor(win));
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - w + 1);
    const slice = values.slice(start, i + 1).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    out[i] = slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : undefined;
  }
  return out;
}

// ── Butterworth 2nd-order low-pass filter (forward-backward for zero phase shift) ──
// Reference: Standard IIR Butterworth design; used in EKGA pipelines [7]

/**
 * Digital Butterworth 2nd-order low-pass filter with forward-backward pass
 * for zero phase distortion. Falls back to SMA for sequences < 10 samples.
 */
export function butterworthLowPass(
  values: (number | undefined)[],
  cutoffHz: number = 12,
  fps: number = 30,
): (number | undefined)[] {
  // Collect defined values with their indices
  const defined: { idx: number; val: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== undefined && Number.isFinite(values[i] as number)) {
      defined.push({ idx: i, val: values[i] as number });
    }
  }

  // Fallback to SMA for short sequences
  if (defined.length < 10) return sma(values, 3);

  // Compute Butterworth coefficients
  const nyquist = fps / 2;
  const normalizedCutoff = Math.min(cutoffHz / nyquist, 0.99);
  const omega = Math.tan(Math.PI * normalizedCutoff);
  const omega2 = omega * omega;
  const sqrt2 = Math.SQRT2;
  const denom = 1 + sqrt2 * omega + omega2;

  const b0 = omega2 / denom;
  const b1 = 2 * omega2 / denom;
  const b2 = omega2 / denom;
  const a1 = (2 * (omega2 - 1)) / denom;
  const a2 = (1 - sqrt2 * omega + omega2) / denom;

  // Extract contiguous signal
  const signal = defined.map(d => d.val);

  // Forward pass
  const forward = new Array(signal.length).fill(0);
  forward[0] = signal[0];
  forward[1] = signal.length > 1 ? signal[1] : signal[0];
  for (let i = 2; i < signal.length; i++) {
    forward[i] = b0 * signal[i] + b1 * signal[i - 1] + b2 * signal[i - 2]
               - a1 * forward[i - 1] - a2 * forward[i - 2];
  }

  // Backward pass (zero-phase)
  const backward = new Array(signal.length).fill(0);
  backward[signal.length - 1] = forward[signal.length - 1];
  backward[signal.length - 2] = signal.length > 1 ? forward[signal.length - 2] : forward[signal.length - 1];
  for (let i = signal.length - 3; i >= 0; i--) {
    backward[i] = b0 * forward[i] + b1 * forward[i + 1] + b2 * forward[i + 2]
                - a1 * backward[i + 1] - a2 * backward[i + 2];
  }

  // Map back to original indices
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  for (let i = 0; i < defined.length; i++) {
    out[defined[i].idx] = backward[i];
  }

  return out;
}

// ── Anatomical constraints validation (ratio-based, scale-invariant) ──
// Reference: Equine proportions from PFERD dataset markers [6]

interface SegmentRatioConstraint {
  name: string;
  numerator: [string, string]; // [pointA, pointB]
  denominator: [string, string]; // [pointC, pointD]
  minRatio: number;
  maxRatio: number;
}

const SEGMENT_RATIO_CONSTRAINTS: SegmentRatioConstraint[] = [
  // Forelimb: hoof-to-fetlock / fetlock-to-carpus
  { name: "lf_hoof_fetlock/fetlock_carpus", numerator: ["lf_hoof", "lf_fetlock"], denominator: ["lf_fetlock", "lf_carpus"], minRatio: 0.3, maxRatio: 0.7 },
  { name: "rf_hoof_fetlock/fetlock_carpus", numerator: ["rf_hoof", "rf_fetlock"], denominator: ["rf_fetlock", "rf_carpus"], minRatio: 0.3, maxRatio: 0.7 },
  // Hindlimb: hoof-to-fetlock / fetlock-to-stifle
  { name: "lh_hoof_fetlock/fetlock_stifle", numerator: ["lh_hoof", "lh_fetlock"], denominator: ["lh_fetlock", "lh_stifle"], minRatio: 0.2, maxRatio: 0.6 },
  { name: "rh_hoof_fetlock/fetlock_stifle", numerator: ["rh_hoof", "rh_fetlock"], denominator: ["rh_fetlock", "rh_stifle"], minRatio: 0.2, maxRatio: 0.6 },
  // Cross-body: foreleg length / hindleg length
  { name: "lf_carpus_shoulder/lh_stifle_hip", numerator: ["lf_carpus", "lf_shoulder"], denominator: ["lh_stifle", "lh_hip"], minRatio: 0.6, maxRatio: 1.4 },
  // Back: withers-to-dock / shoulder-to-hip
  { name: "withers_dock/shoulder_hip", numerator: ["withers", "dock"], denominator: ["lf_shoulder", "lh_hip"], minRatio: 0.8, maxRatio: 1.5 },
];

// Ordinal constraints: Y of pointA must be > Y of pointB (Y-down = lower on screen means higher Y value)
const ORDINAL_CONSTRAINTS: Array<{ lower: string; upper: string; name: string }> = [
  { lower: "lf_hoof", upper: "lf_fetlock", name: "lf_hoof>lf_fetlock" },
  { lower: "rf_hoof", upper: "rf_fetlock", name: "rf_hoof>rf_fetlock" },
  { lower: "lh_hoof", upper: "lh_fetlock", name: "lh_hoof>lh_fetlock" },
  { lower: "rh_hoof", upper: "rh_fetlock", name: "rh_hoof>rh_fetlock" },
  { lower: "lf_fetlock", upper: "lf_carpus", name: "lf_fetlock>lf_carpus" },
  { lower: "rf_fetlock", upper: "rf_carpus", name: "rf_fetlock>rf_carpus" },
];

function dist(a: Point2, b: Point2): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

/**
 * Validate anatomical constraints for a single frame using scale-invariant ratios.
 * Returns list of violated constraint names. Points violating constraints get conf=0.
 */
export function validateAnatomicalConstraints(frame: BiomechFrame): string[] {
  const violations: string[] = [];

  // Ratio constraints
  for (const c of SEGMENT_RATIO_CONSTRAINTS) {
    const pA = frame.points[c.numerator[0]];
    const pB = frame.points[c.numerator[1]];
    const pC = frame.points[c.denominator[0]];
    const pD = frame.points[c.denominator[1]];

    if (!isFinitePoint(pA) || !isFinitePoint(pB) || !isFinitePoint(pC) || !isFinitePoint(pD)) continue;

    const numDist = dist(pA, pB);
    const denDist = dist(pC, pD);
    if (denDist < 0.001) continue; // avoid division by zero

    const ratio = numDist / denDist;
    if (ratio < c.minRatio || ratio > c.maxRatio) {
      violations.push(c.name);
      // Zero confidence for involved points
      if (!frame.conf) frame.conf = {};
      frame.conf[c.numerator[0]] = 0;
      frame.conf[c.numerator[1]] = 0;
    }
  }

  // Ordinal constraints (Y-down: lower point should have larger Y)
  for (const c of ORDINAL_CONSTRAINTS) {
    const lower = frame.points[c.lower];
    const upper = frame.points[c.upper];

    if (!isFinitePoint(lower) || !isFinitePoint(upper)) continue;

    if (lower[1] < upper[1]) {
      // Violation: "lower" point is above "upper" point
      violations.push(c.name);
      if (!frame.conf) frame.conf = {};
      frame.conf[c.lower] = 0;
    }
  }

  frame.constraintViolations = violations;
  return violations;
}

// ── Keypoint smoothing and post-processing ──

/**
 * Apply Butterworth temporal smoothing + outlier rejection + anatomical validation.
 * This is the main post-processing layer that improves LLM keypoint quality.
 */
export function smoothKeypoints(frames: BiomechFrame[], fps: number): BiomechFrame[] {
  if (frames.length < 3) return frames;

  // Collect all keypoint names
  const allKeys = new Set<string>();
  for (const f of frames) {
    for (const k of Object.keys(f.points)) allKeys.add(k);
  }

  // Apply Butterworth filter per keypoint per axis
  for (const key of allKeys) {
    const xValues: (number | undefined)[] = frames.map(f => {
      const p = f.points[key];
      return isFinitePoint(p) ? p[0] : undefined;
    });
    const yValues: (number | undefined)[] = frames.map(f => {
      const p = f.points[key];
      return isFinitePoint(p) ? p[1] : undefined;
    });

    // Outlier rejection (3σ) before smoothing
    const definedX = xValues.filter((v): v is number => v !== undefined);
    const definedY = yValues.filter((v): v is number => v !== undefined);
    const mx = mean(definedX);
    const my = mean(definedY);
    const sx = stdev(definedX);
    const sy = stdev(definedY);

    if (mx !== undefined && sx !== undefined && sx > 0) {
      for (let i = 0; i < xValues.length; i++) {
        if (xValues[i] !== undefined && Math.abs((xValues[i] as number) - mx) > 3 * sx) {
          xValues[i] = undefined; // reject outlier
        }
      }
    }
    if (my !== undefined && sy !== undefined && sy > 0) {
      for (let i = 0; i < yValues.length; i++) {
        if (yValues[i] !== undefined && Math.abs((yValues[i] as number) - my) > 3 * sy) {
          yValues[i] = undefined;
        }
      }
    }

    // Apply Butterworth filter
    const smoothedX = butterworthLowPass(xValues, 12, fps);
    const smoothedY = butterworthLowPass(yValues, 12, fps);

    // Write back
    for (let i = 0; i < frames.length; i++) {
      const newX = smoothedX[i];
      const newY = smoothedY[i];
      if (newX !== undefined && newY !== undefined) {
        frames[i].points[key] = [newX, newY];
      }
    }
  }

  // Velocity capping: reject points with physically impossible speed (>0.15 normalized/frame)
  const maxVelPerFrame = 0.15; // max plausible displacement per frame in normalized coords
  for (const key of allKeys) {
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1].points[key];
      const curr = frames[i].points[key];
      if (isFinitePoint(prev) && isFinitePoint(curr)) {
        const d = dist(prev, curr);
        if (d > maxVelPerFrame) {
          // Interpolate instead
          const next = i + 1 < frames.length ? frames[i + 1].points[key] : undefined;
          if (isFinitePoint(next)) {
            frames[i].points[key] = [(prev[0] + next[0]) / 2, (prev[1] + next[1]) / 2];
          } else {
            frames[i].points[key] = prev; // hold previous
          }
          if (!frames[i].conf) frames[i].conf = {};
          frames[i].conf![key] = 0.2; // low confidence for interpolated
        }
      }
    }
  }

  // Validate anatomical constraints per frame
  for (const f of frames) {
    validateAnatomicalConstraints(f);
    f.smoothed = true;
  }

  // Recalculate confidence based on temporal consistency
  recalculateConfidence(frames);

  return frames;
}

/**
 * Recalculate per-keypoint confidence based on temporal consistency and constraint validity.
 */
function recalculateConfidence(frames: BiomechFrame[]): void {
  if (frames.length < 3) return;

  const allKeys = new Set<string>();
  for (const f of frames) {
    for (const k of Object.keys(f.points)) allKeys.add(k);
  }

  for (const key of allKeys) {
    // Compute frame-to-frame displacements
    const disps: number[] = [];
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1].points[key];
      const curr = frames[i].points[key];
      if (isFinitePoint(prev) && isFinitePoint(curr)) {
        disps.push(dist(prev, curr));
      }
    }

    const meanDisp = mean(disps) ?? 0;
    const stdDisp = stdev(disps) ?? 0;

    for (let i = 0; i < frames.length; i++) {
      if (!frames[i].conf) frames[i].conf = {};

      // Skip if already zeroed by constraint violation
      if (frames[i].conf![key] === 0) continue;

      const originalConf = frames[i].conf![key] ?? 0.7;

      // Temporal consistency bonus/penalty
      let temporalFactor = 1.0;
      if (i > 0 && i < frames.length - 1) {
        const prev = frames[i - 1].points[key];
        const curr = frames[i].points[key];
        if (isFinitePoint(prev) && isFinitePoint(curr) && stdDisp > 0) {
          const d = dist(prev, curr);
          const zScore = Math.abs(d - meanDisp) / stdDisp;
          temporalFactor = zScore < 1 ? 1.0 : zScore < 2 ? 0.8 : 0.5;
        }
      }

      // Constraint violation penalty
      const hasViolation = frames[i].constraintViolations?.some(v =>
        v.includes(key.replace("_hoof", "").replace("_fetlock", "").replace("_carpus", "").replace("_shoulder", "").replace("_stifle", "").replace("_hip", ""))
      );
      const constraintFactor = hasViolation ? 0.5 : 1.0;

      frames[i].conf![key] = clamp01(originalConf * temporalFactor * constraintFactor);
    }
  }
}

// ── Hoof Phase Detection (stance/swing/occluded) ──
// Reference: EKGA stance detection methodology [7]

/**
 * Detect hoof phase (stance/swing/occluded) for each frame per hoof.
 * Uses velocity + ground zone + confidence thresholds.
 */
export function detectHoofPhase(
  frames: BiomechFrame[],
  fps: number,
): { sequence: HoofPhaseSequence; metrics: StanceSwingMetrics } {
  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  const dt = fps > 0 ? 1 / fps : 1 / 30;

  const perHoof: Record<HoofName, HoofPhaseLabel[]> = {
    lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
  };
  const events: HoofPhaseEvent[] = [];

  for (const hoof of hoofNames) {
    const yVals = seriesY(frames, hoof);
    const defined = yVals.filter((v): v is number => v !== undefined);

    if (defined.length < 5) {
      // All occluded
      for (let i = 0; i < frames.length; i++) {
        perHoof[hoof].push("occluded");
        events.push({ hoofName: hoof, frameIndex: i, t: frames[i].t, phase: "occluded", confidence: 0 });
      }
      continue;
    }

    const maxY = Math.max(...defined);
    const minY = Math.min(...defined);
    const range = maxY - minY;
    const groundThreshold = maxY - range * 0.20; // bottom 20% = ground zone

    // Smoothed velocity
    const smoothedY = butterworthLowPass(yVals, 12, fps);
    const velocity: (number | undefined)[] = new Array(frames.length).fill(undefined);
    for (let i = 1; i < frames.length; i++) {
      const prev = smoothedY[i - 1];
      const curr = smoothedY[i];
      if (prev !== undefined && curr !== undefined) {
        velocity[i] = Math.abs((curr - prev) / dt);
      }
    }

    const velDefined = velocity.filter((v): v is number => v !== undefined);
    const velThreshold = (mean(velDefined) ?? 0) * 0.5;

    for (let i = 0; i < frames.length; i++) {
      const conf = frames[i].conf?.[hoof] ?? 0.7;
      const y = smoothedY[i];
      const vel = velocity[i];

      let phase: HoofPhaseLabel;
      let phaseConf: number;

      if (conf < 0.3 || y === undefined) {
        phase = "occluded";
        phaseConf = 0;
      } else if (y >= groundThreshold && (vel === undefined || vel < velThreshold)) {
        phase = "stance";
        phaseConf = clamp01(conf * (range > 0 ? (y - groundThreshold) / (range * 0.20 + 0.001) : 0.5));
      } else {
        phase = "swing";
        phaseConf = clamp01(conf * 0.8);
      }

      perHoof[hoof].push(phase);
      events.push({ hoofName: hoof, frameIndex: i, t: frames[i].t, phase, confidence: phaseConf });
    }
  }

  // Compute stance/swing metrics
  const metricsPerHoof: StanceSwingMetrics["perHoof"] = {} as any;
  let totalDutyFactor = 0;
  let hoofCount = 0;

  for (const hoof of hoofNames) {
    const phases = perHoof[hoof];
    const stanceCount = phases.filter(p => p === "stance").length;
    const swingCount = phases.filter(p => p === "swing").length;
    const occludedCount = phases.filter(p => p === "occluded").length;
    const activeCount = stanceCount + swingCount;

    const stanceDurationMs = stanceCount * dt * 1000;
    const swingDurationMs = swingCount * dt * 1000;
    const dutyFactor = activeCount > 0 ? stanceCount / activeCount : 0;
    const occludedPct = frames.length > 0 ? occludedCount / frames.length : 0;

    metricsPerHoof[hoof] = {
      stanceDurationMs: Math.round(stanceDurationMs),
      swingDurationMs: Math.round(swingDurationMs),
      dutyFactor: Math.round(dutyFactor * 1000) / 1000,
      occludedPct: Math.round(occludedPct * 1000) / 1000,
    };

    if (activeCount > 0) {
      totalDutyFactor += dutyFactor;
      hoofCount++;
    }
  }

  return {
    sequence: { events, perHoof },
    metrics: {
      perHoof: metricsPerHoof,
      overallDutyFactor: hoofCount > 0 ? Math.round((totalDutyFactor / hoofCount) * 1000) / 1000 : 0,
    },
  };
}

// ── Motion energy & hoof activity signals for Window Selector ──

/**
 * Compute motion energy for a window: sum of velocity magnitudes across all keypoints.
 */
export function computeMotionEnergy(frames: BiomechFrame[]): number {
  if (frames.length < 2) return 0;

  let totalEnergy = 0;
  let count = 0;

  for (let i = 1; i < frames.length; i++) {
    for (const key of Object.keys(frames[i].points)) {
      const prev = frames[i - 1].points[key];
      const curr = frames[i].points[key];
      if (isFinitePoint(prev) && isFinitePoint(curr)) {
        totalEnergy += dist(prev, curr);
        count++;
      }
    }
  }

  return count > 0 ? totalEnergy / count : 0;
}

/**
 * Compute hoof activity rate: fraction of frames where any hoof has significant movement.
 */
export function computeHoofActivityRate(frames: BiomechFrame[]): number {
  if (frames.length < 2) return 0;

  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  const movementThreshold = 0.005; // normalized displacement threshold
  let activeFrames = 0;

  for (let i = 1; i < frames.length; i++) {
    let anyActive = false;
    for (const hoof of hoofNames) {
      const prev = frames[i - 1].points[hoof];
      const curr = frames[i].points[hoof];
      if (isFinitePoint(prev) && isFinitePoint(curr)) {
        if (dist(prev, curr) > movementThreshold) {
          anyActive = true;
          break;
        }
      }
    }
    if (anyActive) activeFrames++;
  }

  return activeFrames / (frames.length - 1);
}

/** Extract Y series for a named point across frames */
export function seriesY(frames: BiomechFrame[], name: string): (number | undefined)[] {
  return frames.map((f) => {
    const p = f.points[name];
    return isFinitePoint(p) ? p[1] : undefined;
  });
}

/** Extract X series for a named point */
function seriesX(frames: BiomechFrame[], name: string): (number | undefined)[] {
  return frames.map((f) => {
    const p = f.points[name];
    return isFinitePoint(p) ? p[0] : undefined;
  });
}

// ── Hoof event detection (legacy — kept for phase lags / dissociation) ──

interface HoofEvent {
  type: "touchdown" | "liftoff";
  frameIndex: number;
  t: number;
}

function detectHoofEvents(frames: BiomechFrame[], hoofName: string): HoofEvent[] {
  const yVals = seriesY(frames, hoofName);
  const defined = yVals.filter((v): v is number => v !== undefined);
  if (defined.length < 3) return [];

  const maxY = Math.max(...defined);
  const minY = Math.min(...defined);
  const range = maxY - minY;
  if (range < 0.005) return [];

  const threshold = maxY - range * 0.15;
  const events: HoofEvent[] = [];
  let wasGrounded = yVals[0] !== undefined && yVals[0] >= threshold;

  for (let i = 1; i < frames.length; i++) {
    const y = yVals[i];
    if (y === undefined) continue;
    const isGrounded = y >= threshold;
    if (!wasGrounded && isGrounded) {
      events.push({ type: "touchdown", frameIndex: i, t: frames[i].t });
    } else if (wasGrounded && !isGrounded) {
      events.push({ type: "liftoff", frameIndex: i, t: frames[i].t });
    }
    wasGrounded = isGrounded;
  }
  return events;
}

function touchdownTimes(frames: BiomechFrame[], hoofName: string): number[] {
  return detectHoofEvents(frames, hoofName)
    .filter((e) => e.type === "touchdown")
    .map((e) => e.t);
}

// ── Enhanced 3-signal foot-contact detection ──
// Signals: (1) Vy zero-crossing, (2) Ax horizontal acceleration, (3) Hoof-Fetlock angle rate
// Reference: Shaffer et al. 2025, EKGA pipeline

const HOOF_FETLOCK_MAP: Record<HoofName, string> = {
  lf_hoof: "lf_fetlock",
  rf_hoof: "rf_fetlock",
  lh_hoof: "lh_fetlock",
  rh_hoof: "rh_fetlock",
};

const HOOF_UPPER_JOINT_MAP: Record<HoofName, string> = {
  lf_hoof: "lf_carpus",
  rf_hoof: "rf_carpus",
  lh_hoof: "lh_stifle",
  rh_hoof: "rh_stifle",
};

/**
 * Compute angle (degrees) at joint B formed by points A-B-C.
 */
function angleDeg(a: Point2 | undefined, b: Point2 | undefined, c: Point2 | undefined): number | undefined {
  if (!isFinitePoint(a) || !isFinitePoint(b) || !isFinitePoint(c)) return undefined;
  const ba = [a[0] - b[0], a[1] - b[1]];
  const bc = [c[0] - b[0], c[1] - b[1]];
  const dot = ba[0] * bc[0] + ba[1] * bc[1];
  const magA = Math.sqrt(ba[0] ** 2 + ba[1] ** 2);
  const magC = Math.sqrt(bc[0] ** 2 + bc[1] ** 2);
  if (magA < 1e-6 || magC < 1e-6) return undefined;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Signal 1: Vertical velocity zero-crossings (positive → negative = touchdown).
 * Returns per-frame score 0..1 where peaks near zero-crossing in ground zone score high.
 */
function computeVyZeroCrossingSignal(
  smoothedY: (number | undefined)[],
  frames: BiomechFrame[],
  groundThreshold: number,
): (number | undefined)[] {
  const n = frames.length;
  const signal: (number | undefined)[] = new Array(n).fill(undefined);
  
  // Compute velocity
  const vy: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 1; i < n; i++) {
    const prev = smoothedY[i - 1];
    const curr = smoothedY[i];
    if (prev !== undefined && curr !== undefined) {
      const dt = frames[i].t - frames[i - 1].t;
      if (dt > 0) vy[i] = (curr - prev) / dt;
    }
  }

  for (let i = 2; i < n - 1; i++) {
    const y = smoothedY[i];
    if (y === undefined || y < groundThreshold) continue;
    
    const vPrev = vy[i - 1];
    const vCurr = vy[i];
    const vNext = vy[i + 1];
    
    // Zero-crossing: velocity changes sign (positive→negative = descending→ground)
    // Or velocity near zero at local Y maximum
    let score = 0;
    
    if (vPrev !== undefined && vCurr !== undefined) {
      // Sign change (positive to negative or near zero)
      if (vPrev > 0 && vCurr <= 0) {
        score = 0.9; // strong touchdown signal
      } else if (Math.abs(vCurr) < Math.abs(vPrev) * 0.3 && Math.abs(vCurr) < 0.5) {
        score = 0.6; // velocity decelerating near zero
      }
    }
    
    // Boost if it's also a local Y max (lowest physical point)
    const yPrev = smoothedY[i - 1];
    const yNext = smoothedY[i + 1];
    if (yPrev !== undefined && yNext !== undefined && y >= yPrev && y >= yNext) {
      score = Math.min(1, score + 0.3);
    }
    
    signal[i] = score > 0 ? score : undefined;
  }
  
  return signal;
}

/**
 * Signal 2: Horizontal acceleration (Ax) — braking peak indicates mid-stance.
 * Returns per-frame score 0..1 where sudden horizontal deceleration scores high.
 */
function computeAxBrakingSignal(
  frames: BiomechFrame[],
  hoofName: string,
  groundThreshold: number,
  smoothedY: (number | undefined)[],
): (number | undefined)[] {
  const n = frames.length;
  const signal: (number | undefined)[] = new Array(n).fill(undefined);
  
  // Extract X series and smooth
  const hoofX = frames.map(f => {
    const p = f.points[hoofName];
    return isFinitePoint(p) ? p[0] : undefined;
  });
  const smoothedX = butterworthLowPass(hoofX, 12, 30);
  
  // Compute velocity (Vx)
  const vx: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 1; i < n; i++) {
    const prev = smoothedX[i - 1];
    const curr = smoothedX[i];
    if (prev !== undefined && curr !== undefined) {
      const dt = frames[i].t - frames[i - 1].t;
      if (dt > 0) vx[i] = (curr - prev) / dt;
    }
  }
  
  // Compute acceleration (Ax)
  const ax: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 2; i < n; i++) {
    const vPrev = vx[i - 1];
    const vCurr = vx[i];
    if (vPrev !== undefined && vCurr !== undefined) {
      const dt = frames[i].t - frames[i - 1].t;
      if (dt > 0) ax[i] = (vCurr - vPrev) / dt;
    }
  }
  
  // Find max |Ax| for normalization
  const axDefined = ax.filter((v): v is number => v !== undefined).map(Math.abs);
  const maxAx = axDefined.length > 0 ? Math.max(...axDefined) : 1;
  if (maxAx < 1e-6) return signal;
  
  for (let i = 2; i < n - 1; i++) {
    const y = smoothedY[i];
    if (y === undefined || y < groundThreshold) continue; // only in ground zone
    
    const a = ax[i];
    if (a === undefined) continue;
    
    // Braking = negative acceleration (deceleration) or high magnitude
    // During stance, the hoof should be relatively stationary → low Vx but possible braking peak
    const normalizedAx = Math.abs(a) / maxAx;
    
    // Score based on deceleration magnitude
    if (normalizedAx > 0.15) {
      signal[i] = clamp01(normalizedAx * 0.8);
    }
  }
  
  return signal;
}

/**
 * Signal 3: Hoof-Fetlock angle change rate — max rate at breakover/contact.
 * Returns per-frame score 0..1 where rapid angle changes near ground score high.
 */
function computeAngleRateSignal(
  frames: BiomechFrame[],
  hoofName: HoofName,
  groundThreshold: number,
  smoothedY: (number | undefined)[],
): (number | undefined)[] {
  const n = frames.length;
  const signal: (number | undefined)[] = new Array(n).fill(undefined);
  
  const fetlockName = HOOF_FETLOCK_MAP[hoofName];
  const upperJointName = HOOF_UPPER_JOINT_MAP[hoofName];
  
  // Compute hoof-fetlock-upper angle per frame
  const angles: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 0; i < n; i++) {
    angles[i] = angleDeg(
      frames[i].points[hoofName],
      frames[i].points[fetlockName],
      frames[i].points[upperJointName],
    );
  }
  
  // Smooth angles
  const smoothedAngles = butterworthLowPass(angles, 10, 30);
  
  // Compute angular rate (dθ/dt)
  const angleRate: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 1; i < n; i++) {
    const prev = smoothedAngles[i - 1];
    const curr = smoothedAngles[i];
    if (prev !== undefined && curr !== undefined) {
      const dt = frames[i].t - frames[i - 1].t;
      if (dt > 0) angleRate[i] = Math.abs(curr - prev) / dt;
    }
  }
  
  // Find max rate for normalization
  const rateDefined = angleRate.filter((v): v is number => v !== undefined);
  const maxRate = rateDefined.length > 0 ? Math.max(...rateDefined) : 1;
  if (maxRate < 1e-6) return signal;
  
  for (let i = 2; i < n - 1; i++) {
    const y = smoothedY[i];
    if (y === undefined) continue;
    
    const rate = angleRate[i];
    if (rate === undefined) continue;
    
    const normalizedRate = rate / maxRate;
    
    // High angle change rate near ground = contact or breakover
    if (normalizedRate > 0.2 && y >= groundThreshold * 0.8) {
      signal[i] = clamp01(normalizedRate * 0.7);
    }
  }
  
  return signal;
}

/**
 * Enhanced foot-contact detection using 3-signal fusion.
 * Signals: (1) Vy zero-crossing, (2) Ax braking, (3) Hoof-Fetlock angle rate.
 * Confidence is based on agreement between signals.
 */
export function detectFootContacts(
  frames: BiomechFrame[],
  hoofName: HoofName,
): FootContactEvent[] {
  const hoofY = seriesY(frames, hoofName);
  const defined = hoofY.filter((v): v is number => v !== undefined);
  if (defined.length < 5) return [];

  const maxY = Math.max(...defined);
  const minY = Math.min(...defined);
  const range = maxY - minY;
  if (range < 0.003) return [];

  // Smoothed Y series
  const smoothedY = butterworthLowPass(hoofY, 12, 30);
  
  // Ground zone: bottom 20% of Y range
  const groundThreshold = maxY - range * 0.20;

  // Compute all 3 signals
  const signal1 = computeVyZeroCrossingSignal(smoothedY, frames, groundThreshold);
  const signal2 = computeAxBrakingSignal(frames, hoofName, groundThreshold, smoothedY);
  const signal3 = computeAngleRateSignal(frames, hoofName, groundThreshold, smoothedY);

  // Fuse signals: weighted combination
  const W1 = 0.45; // Vy zero-crossing (primary, most reliable)
  const W2 = 0.25; // Ax braking (secondary)
  const W3 = 0.30; // Angle rate (secondary, but informative)

  const fusedScore: (number | undefined)[] = new Array(frames.length).fill(undefined);
  const signalAgreement: number[] = new Array(frames.length).fill(0);

  for (let i = 0; i < frames.length; i++) {
    const s1 = signal1[i];
    const s2 = signal2[i];
    const s3 = signal3[i];
    
    // Count how many signals fired
    const fired = [s1, s2, s3].filter(v => v !== undefined && v > 0.1);
    if (fired.length === 0) continue;
    
    // Weighted fusion (missing signals get 0)
    const v1 = s1 ?? 0;
    const v2 = s2 ?? 0;
    const v3 = s3 ?? 0;
    
    const totalWeight = (s1 !== undefined ? W1 : 0) + (s2 !== undefined ? W2 : 0) + (s3 !== undefined ? W3 : 0);
    if (totalWeight < 0.1) continue;
    
    const weighted = (v1 * W1 + v2 * W2 + v3 * W3) / totalWeight;
    fusedScore[i] = weighted;
    signalAgreement[i] = fired.length;
  }

  // Extract contact events from fused signal peaks
  const contacts: FootContactEvent[] = [];
  const minInterval = 3;

  for (let i = 2; i < frames.length - 1; i++) {
    const score = fusedScore[i];
    if (score === undefined || score < 0.25) continue;

    // Must be a local peak in fused score
    const sPrev = fusedScore[i - 1] ?? 0;
    const sNext = fusedScore[i + 1] ?? 0;
    if (score < sPrev || score < sNext) continue;

    // Minimum interval
    if (contacts.length > 0 && (i - contacts[contacts.length - 1].frameIndex) < minInterval) continue;

    // Confidence from fusion score + agreement bonus
    let conf = score * 0.6; // base from fused signal strength
    
    // Agreement bonus: more signals agree = higher confidence
    const agreement = signalAgreement[i];
    if (agreement >= 3) conf += 0.3;      // all 3 signals agree
    else if (agreement >= 2) conf += 0.15; // 2 signals agree
    
    // Position clarity: closer to max Y = more ground
    const y = smoothedY[i];
    if (y !== undefined) {
      conf += 0.1 * clamp01((y - groundThreshold) / (range * 0.20));
    }

    conf = clamp01(conf);
    if (conf < 0.3) continue;

    contacts.push({
      hoofName,
      frameIndex: i,
      t: frames[i].t,
      confidence: Math.round(conf * 100) / 100,
    });
  }

  return contacts;
}

// ── Feature vector extraction ──

function computeLagsBetweenContacts(
  contactsA: FootContactEvent[],
  contactsB: FootContactEvent[],
): { mean: number; std: number } | undefined {
  if (!contactsA.length || !contactsB.length) return undefined;
  const lags: number[] = [];
  for (const a of contactsA) {
    let minDiff = Infinity;
    for (const b of contactsB) {
      const diff = Math.abs(b.t - a.t);
      if (diff < minDiff) minDiff = diff;
    }
    if (Number.isFinite(minDiff)) lags.push(minDiff * 1000); // ms
  }
  const m = mean(lags);
  const s = stdev(lags);
  if (m === undefined) return undefined;
  return { mean: m, std: s ?? 0 };
}

function detectFootfallOrder(allContacts: FootContactEvent[]): string {
  if (allContacts.length < 4) return "unknown";

  // Sort by time
  const sorted = [...allContacts].sort((a, b) => a.t - b.t);

  // Extract 4-contact groups and find most common order
  const orders: Record<string, number> = {};
  for (let i = 0; i <= sorted.length - 4; i++) {
    const group = sorted.slice(i, i + 4);
    // Only count if all 4 hoofs are different
    const hoofs = new Set(group.map(c => c.hoofName));
    if (hoofs.size === 4) {
      const nameMap: Record<string, string> = {
        lf_hoof: "LF", rf_hoof: "RF", lh_hoof: "LH", rh_hoof: "RH",
      };
      const order = group.map(c => nameMap[c.hoofName]).join("-");
      orders[order] = (orders[order] || 0) + 1;
    }
  }

  let bestOrder = "unknown";
  let bestCount = 0;
  for (const [order, count] of Object.entries(orders)) {
    if (count > bestCount) { bestCount = count; bestOrder = order; }
  }
  return bestOrder;
}

export function computeGaitFeatures(
  frames: BiomechFrame[],
  fps: number,
  contacts: Record<HoofName, FootContactEvent[]>,
): GaitFeatureVector {
  // Lateral lags: LF-LH, RF-RH
  const lfLh = computeLagsBetweenContacts(contacts.lf_hoof, contacts.lh_hoof);
  const rfRh = computeLagsBetweenContacts(contacts.rf_hoof, contacts.rh_hoof);
  const latLags = [lfLh, rfRh].filter((v): v is { mean: number; std: number } => v !== undefined);
  const meanLatLag = mean(latLags.map(l => l.mean)) ?? 0;
  const stdLatLag = mean(latLags.map(l => l.std)) ?? 0;

  // Diagonal lags: LF-RH, RF-LH
  const lfRh = computeLagsBetweenContacts(contacts.lf_hoof, contacts.rh_hoof);
  const rfLh = computeLagsBetweenContacts(contacts.rf_hoof, contacts.lh_hoof);
  const diagLags = [lfRh, rfLh].filter((v): v is { mean: number; std: number } => v !== undefined);
  const meanDiagLag = mean(diagLags.map(l => l.mean)) ?? 0;
  const stdDiagLag = mean(diagLags.map(l => l.std)) ?? 0;

  // Beat evenness: 1 - CV% of all inter-contact intervals
  const allContacts = Object.values(contacts).flat().sort((a, b) => a.t - b.t);
  const interContactIntervals: number[] = [];
  for (let i = 1; i < allContacts.length; i++) {
    interContactIntervals.push(allContacts[i].t - allContacts[i - 1].t);
  }
  const iciMean = mean(interContactIntervals);
  const iciStd = stdev(interContactIntervals);
  const beatEvenness = (iciMean && iciStd && iciMean > 0)
    ? clamp01(1 - (iciStd / iciMean))
    : 0;

  // Stride variability: CV% of stride intervals per leg
  const cvPerLeg: number[] = [];
  for (const hoof of Object.keys(contacts) as HoofName[]) {
    const tds = contacts[hoof].map(c => c.t);
    if (tds.length < 3) continue;
    const intervals: number[] = [];
    for (let i = 1; i < tds.length; i++) intervals.push(tds[i] - tds[i - 1]);
    const m = mean(intervals);
    const s = stdev(intervals);
    if (m && s && m > 0) cvPerLeg.push((s / m) * 100);
  }
  const strideVariability = mean(cvPerLeg) ?? 0;

  // Head-pelvis stability: CV% of head-pelvis vertical difference across frames
  const headY = seriesY(frames, "poll").filter((v): v is number => v !== undefined);
  const pelvisY = seriesY(frames, "dock").filter((v): v is number => v !== undefined);
  const minLen = Math.min(headY.length, pelvisY.length);
  const hpDiffs: number[] = [];
  for (let i = 0; i < minLen; i++) hpDiffs.push(headY[i] - pelvisY[i]);
  const hpMean = mean(hpDiffs);
  const hpStd = stdev(hpDiffs);
  const headPelvisStability = (hpMean && hpStd && Math.abs(hpMean) > 0.001)
    ? (hpStd / Math.abs(hpMean)) * 100
    : 0;

  // Suspension proxy: mean peak vertical velocity of hoofs
  const peakVelocities: number[] = [];
  for (const hoof of Object.keys(contacts) as HoofName[]) {
    const yVals = seriesY(frames, hoof);
    const smoothed = sma(yVals, 3);
    for (let i = 1; i < smoothed.length; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      if (prev !== undefined && curr !== undefined) {
        const dt = frames[i].t - frames[i - 1].t;
        if (dt > 0) peakVelocities.push(Math.abs((curr - prev) / dt));
      }
    }
  }
  // Top 10% of velocities as proxy
  peakVelocities.sort((a, b) => b - a);
  const topN = Math.max(1, Math.floor(peakVelocities.length * 0.1));
  const suspensionProxy = mean(peakVelocities.slice(0, topN)) ?? 0;

  // Contact confidence: mean of all contact confidences
  const allConfs = allContacts.map(c => c.confidence);
  const contactEventConfidence = mean(allConfs) ?? 0;

  // Footfall order
  const footfallOrder = detectFootfallOrder(allContacts);

  return {
    meanLateralLag: Math.round(meanLatLag * 10) / 10,
    stdLateralLag: Math.round(stdLatLag * 10) / 10,
    meanDiagonalLag: Math.round(meanDiagLag * 10) / 10,
    stdDiagonalLag: Math.round(stdDiagLag * 10) / 10,
    beatEvenness: Math.round(beatEvenness * 1000) / 1000,
    strideVariability: Math.round(strideVariability * 10) / 10,
    headPelvisStability: Math.round(headPelvisStability * 10) / 10,
    suspensionProxy: Math.round(suspensionProxy * 10000) / 10000,
    contactEventConfidence: Math.round(contactEventConfidence * 100) / 100,
    footfallOrder,
  };
}

// ── Score-based hybrid classification ──

interface ClassScoreEntry {
  classification: GaitClassification["classification"];
  score: number;
  reasons: string[];
}

// Internal heuristic thresholds, pending calibration against expert-labeled horse videos.
// Export the production entry point so regression suites cannot drift into shadow implementations.
export function classifyFromFeatures(features: GaitFeatureVector, breedId?: string): GaitClassification {
  const {
    meanDiagonalLag: diagLag, meanLateralLag: latLag,
    beatEvenness, strideVariability, contactEventConfidence, footfallOrder,
  } = features;
  const breed = (breedId ?? "").toLowerCase();
  const isPacerBreed = breed.includes("pacer") || breed.includes("standardbred") || breed.includes("pace");

  const ratio = diagLag > 0 ? latLag / diagLag : 1;
  const entries: ClassScoreEntry[] = [];

  // ── Diagonal (trot) score ──
  {
    let s = 0; const r: string[] = [];
    if (diagLag < 30) { s += 0.4; r.push(`diagonal lag ${diagLag}ms < 30`); }
    if (latLag > 50) { s += 0.3; r.push(`lateral lag ${latLag}ms > 50`); }
    s += 0.2 * clamp01((latLag - diagLag) / 100);
    if (beatEvenness > 0.5) { s += 0.1; r.push(`evenness ${beatEvenness}`); }
    entries.push({ classification: "diagonal", score: clamp01(s), reasons: r });
  }

  // ── Lateral (pace) score ──
  {
    let s = 0; const r: string[] = [];
    if (latLag < 30) { s += 0.4; r.push(`lateral lag ${latLag}ms < 30`); }
    if (diagLag > 50) { s += 0.3; r.push(`diagonal lag ${diagLag}ms > 50`); }
    s += 0.2 * clamp01((diagLag - latLag) / 100);
    if (isPacerBreed) { s += 0.1; r.push("pacer breed bonus"); }
    entries.push({ classification: "lateral", score: clamp01(s), reasons: r });
  }

  // ── Singlefoot score ──
  {
    let s = 0; const r: string[] = [];
    if (diagLag > 30 && latLag > 30) { s += 0.2; r.push(`both lags > 30ms`); }
    if (ratio < 0.7) { s += 0.25; r.push(`lat/diag ratio ${ratio.toFixed(2)} < 0.7`); }
    if (beatEvenness > 0.6) { s += 0.25 * beatEvenness; r.push(`beat evenness ${beatEvenness}`); }
    if (contactEventConfidence > 0.5) { s += 0.15; r.push(`contact confidence ${contactEventConfidence}`); }
    if (strideVariability < 15) { s += 0.1; r.push(`stride variability ${strideVariability}% low`); }
    entries.push({ classification: "singlefoot", score: clamp01(s), reasons: r });
  }

  // ── Four-beat score ──
  {
    let s = 0; const r: string[] = [];
    if (diagLag > 30 && latLag > 30) { s += 0.2; r.push(`both lags > 30ms`); }
    if (ratio >= 0.7 && ratio <= 1.3) { s += 0.25; r.push(`ratio ${ratio.toFixed(2)} near 1.0`); }
    if (beatEvenness > 0.7) { s += 0.3 * beatEvenness; r.push(`evenness ${beatEvenness}`); }
    if (strideVariability < 10) { s += 0.1; r.push(`low variability ${strideVariability}%`); }
    entries.push({ classification: "four_beat", score: clamp01(s), reasons: r });
  }

  // ── Broken pace score ──
  {
    let s = 0; const r: string[] = [];
    if (ratio < 0.7 && beatEvenness < 0.6) { s += 0.35; r.push(`ratio ${ratio.toFixed(2)} + low evenness ${beatEvenness}`); }
    if (isPacerBreed) { s += 0.2; r.push("pacer breed"); }
    if (latLag > 20 && latLag < 50) { s += 0.15; r.push(`lateral lag ${latLag}ms mid-range`); }
    entries.push({ classification: "broken_pace", score: clamp01(s), reasons: r });
  }

  // Sort by score descending
  entries.sort((a, b) => b.score - a.score);
  const winner = entries[0];
  const runner = entries[1];
  const totalScore = entries.reduce((s, e) => s + e.score, 0);
  let confidence = totalScore > 0 ? winner.score / totalScore : 0;

  // Quality penalties
  if (contactEventConfidence < 0.5) confidence *= 0.6;
  if (features.stdLateralLag > 30) confidence *= 0.8;
  if (strideVariability > 20) confidence *= 0.85;

  // --- Breed/DMRT3 Soft Priors (confidence-only adjustment) ---
  let breedPriorDelta = 0;
  const reasonParts: string[] = [winner.reasons.join("; ")];

  if (breedId) {
    const bid = breedId.toLowerCase();
    // Standardbred pacer → boost lateral confidence
    if ((bid.includes("standardbred") || bid.includes("pacer")) && winner.classification === "lateral") {
      breedPriorDelta = 0.06;
    }
    // Icelandic / gaited breeds → boost four_beat / singlefoot
    if ((bid.includes("icelandic") || bid.includes("paso") || bid.includes("rocky")) &&
        (winner.classification === "four_beat" || winner.classification === "singlefoot")) {
      breedPriorDelta = 0.05;
    }
    // Missouri Fox Trotter → boost singlefoot
    if (bid.includes("fox") && winner.classification === "singlefoot") {
      breedPriorDelta = 0.05;
    }
    // TWH → singlefoot/broken_pace
    if (bid.includes("walking") && (winner.classification === "singlefoot" || winner.classification === "broken_pace")) {
      breedPriorDelta = 0.06;
    }

    if (breedPriorDelta > 0) {
      confidence += breedPriorDelta;
      reasonParts.push(`breed prior ${bid} (+${breedPriorDelta})`);
    }
  }

  // --- Inconclusive vs Unknown ---
  let classification: GaitClassification["classification"];
  if (confidence < 0.15) {
    classification = "unknown";
  } else if (
    confidence < 0.35 &&
    runner &&
    Math.abs(winner.score - runner.score) < 0.08
  ) {
    classification = "inconclusive";
  } else if (confidence < 0.25) {
    classification = "unknown";
  } else {
    classification = winner.classification;
  }

  const classificationReason = reasonParts.filter(Boolean).join("; ");

  const alternatives = entries.slice(1, 3).map(e => ({
    classification: e.classification,
    score: Math.round(e.score * 100) / 100,
  }));

  return {
    classification,
    confidence: Math.round(clamp01(confidence) * 100) / 100,
    alternatives,
    classificationReason,
    breedPriorDelta: breedPriorDelta > 0 ? breedPriorDelta : undefined,
  };
}

// ── Windowed classification ──

function computeMissingRateForWindow(frames: BiomechFrame[]): number {
  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  let totalSlots = 0;
  let missingSlots = 0;
  for (const f of frames) {
    for (const h of hoofNames) {
      totalSlots++;
      if (!isFinitePoint(f.points[h])) missingSlots++;
    }
  }
  return totalSlots > 0 ? missingSlots / totalSlots : 1;
}

/**
 * Windowed gait classification with majority vote.
 * Splits frames into ~3s windows with 50% overlap.
 */
function classifyGaitWindowed(frames: BiomechFrame[], fps: number, breedId?: string): GaitClassification {
  const windowSize = Math.max(10, Math.round(fps * 3)); // ~3 seconds
  const step = Math.max(5, Math.round(windowSize * 0.5)); // 50% overlap
  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];

  const windows: GaitWindow[] = [];

  for (let start = 0; start + windowSize <= frames.length; start += step) {
    const end = start + windowSize;
    const windowFrames = frames.slice(start, end);

    // Detect contacts for this window
    const contacts: Record<HoofName, FootContactEvent[]> = {
      lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
    };
    for (const hoof of hoofNames) {
      contacts[hoof] = detectFootContacts(windowFrames, hoof);
    }

    const totalContacts = Object.values(contacts).reduce((s, c) => s + c.length, 0);
    if (totalContacts < 4) continue; // not enough contacts

    const features = computeGaitFeatures(windowFrames, fps, contacts);
    const classification = classifyFromFeatures(features, breedId);
    const missingRate = computeMissingRateForWindow(windowFrames);
    const quality = clamp01(features.contactEventConfidence * (1 - missingRate));

    windows.push({
      startFrame: start,
      endFrame: end,
      startT: frames[start].t,
      endT: frames[end - 1].t,
      features,
      classification,
      quality,
    });
  }

  // Filter low quality windows
  const qualityWindows = windows.filter(w => w.quality >= 0.4);

  if (qualityWindows.length === 0) {
    // Fallback: use all windows or return unknown
    if (windows.length === 0) {
      return { classification: "unknown", confidence: 0, totalWindows: 0, qualityWindows: 0 };
    }
    // Use best window
    const best = windows.reduce((a, b) => a.quality > b.quality ? a : b);
    return {
      ...best.classification,
      totalWindows: windows.length,
      qualityWindows: 0,
      windowVotes: { [best.classification.classification]: 1 },
    };
  }

  // Weighted majority vote
  const votes: Record<string, number> = {};
  for (const w of qualityWindows) {
    const key = w.classification.classification;
    votes[key] = (votes[key] || 0) + w.classification.confidence * w.quality;
  }

  // Find winner
  let winner = "unknown";
  let maxVote = 0;
  let totalVote = 0;
  for (const [key, vote] of Object.entries(votes)) {
    totalVote += vote;
    if (vote > maxVote) { maxVote = vote; winner = key; }
  }

  const finalConfidence = totalVote > 0 ? maxVote / totalVote : 0;

  // If confidence too low, mark as unknown
  const classification = finalConfidence < 0.5 ? "unknown" : winner as GaitClassification["classification"];

  // Stride frequency from best quality window
  const bestWindow = qualityWindows.reduce((a, b) => a.quality > b.quality ? a : b);
  const lfContacts = detectFootContacts(frames.slice(bestWindow.startFrame, bestWindow.endFrame), "lf_hoof");
  let strideFrequencyHz: number | undefined;
  if (lfContacts.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < lfContacts.length; i++) intervals.push(lfContacts[i].t - lfContacts[i - 1].t);
    const avg = mean(intervals);
    if (avg && avg > 0) strideFrequencyHz = Math.round((1 / avg) * 100) / 100;
  }

  // Aggregate alternatives from best window's classification
  const bestWindowClass = bestWindow.classification;
  const alternatives = bestWindowClass.alternatives;
  const classificationReason = bestWindowClass.classificationReason;

  return {
    classification,
    confidence: Math.round(clamp01(finalConfidence) * 100) / 100,
    strideFrequencyHz,
    windowVotes: votes,
    totalWindows: windows.length,
    qualityWindows: qualityWindows.length,
    alternatives,
    classificationReason,
  };
}

// ── Window quality metrics for LLM Segment Selector ──

export function computeWindowQualityMetrics(
  frames: BiomechFrame[],
  fps: number,
): WindowQualityMetrics[] {
  const windowSize = Math.max(10, Math.round(fps * 3));
  const step = Math.max(5, Math.round(windowSize * 0.5));
  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  const results: WindowQualityMetrics[] = [];

  for (let start = 0, idx = 0; start + windowSize <= frames.length; start += step, idx++) {
    const windowFrames = frames.slice(start, start + windowSize);

    // Missing keypoints %
    let totalSlots = 0;
    let missingSlots = 0;
    for (const f of windowFrames) {
      for (const h of hoofNames) {
        totalSlots++;
        if (!isFinitePoint(f.points[h])) missingSlots++;
      }
    }
    const missingPct = totalSlots > 0 ? missingSlots / totalSlots : 1;

    // Blur proxy: variance of frame-to-frame dx/dy across all points
    const diffs: number[] = [];
    for (let i = 1; i < windowFrames.length; i++) {
      for (const h of hoofNames) {
        const prev = windowFrames[i - 1].points[h];
        const curr = windowFrames[i].points[h];
        if (isFinitePoint(prev) && isFinitePoint(curr)) {
          diffs.push(Math.abs(curr[0] - prev[0]) + Math.abs(curr[1] - prev[1]));
        }
      }
    }
    const diffMean = mean(diffs);
    const diffStd = stdev(diffs);
    const blurProxy = diffStd ?? 0;

    // Camera motion: centroid shift between frames
    const centroids: [number, number][] = [];
    for (const f of windowFrames) {
      const pts = Object.values(f.points).filter((p): p is Point2 => isFinitePoint(p));
      if (pts.length > 0) {
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        centroids.push([cx, cy]);
      }
    }
    const centroidShifts: number[] = [];
    for (let i = 1; i < centroids.length; i++) {
      centroidShifts.push(
        Math.sqrt((centroids[i][0] - centroids[i - 1][0]) ** 2 + (centroids[i][1] - centroids[i - 1][1]) ** 2)
      );
    }
    const cameraMotion = mean(centroidShifts) ?? 0;

    // Horse stability: variance of body center position
    const bodyCenters: number[] = [];
    for (const f of windowFrames) {
      const w = f.points["withers"];
      const d = f.points["dock"];
      if (isFinitePoint(w) && isFinitePoint(d)) {
        bodyCenters.push((w[0] + d[0]) / 2);
      }
    }
    const horseStability = 1 - Math.min(1, (stdev(bodyCenters) ?? 0) * 10);

    // Motion energy signal
    const motionEnergy = computeMotionEnergy(windowFrames);

    // Hoof activity rate signal
    const hoofActivityRate = computeHoofActivityRate(windowFrames);

    results.push({
      index: idx,
      missingPct: Math.round(missingPct * 1000) / 1000,
      blurProxy: Math.round(blurProxy * 10000) / 10000,
      cameraMotion: Math.round(cameraMotion * 10000) / 10000,
      horseStability: Math.round(Math.max(0, horseStability) * 1000) / 1000,
      motionEnergy: Math.round(motionEnergy * 10000) / 10000,
      hoofActivityRate: Math.round(hoofActivityRate * 1000) / 1000,
    });
  }

  return results;
}

// ── Quality metrics ──

function computeQualityMetrics(frames: BiomechFrame[], fps: number): BiomechQuality {
  const allPoints = new Set<string>();
  for (const f of frames) {
    for (const k of Object.keys(f.points)) allPoints.add(k);
  }
  const missingRate: Record<string, number> = {};
  for (const name of allPoints) {
    let missing = 0;
    for (const f of frames) {
      if (!isFinitePoint(f.points[name])) missing++;
    }
    missingRate[name] = Math.round((missing / frames.length) * 1000) / 1000;
  }
  return { frames: frames.length, fps, missingRate };
}

// ── Phase lags (legacy, still used for timing display) ──

function computePhaseLags(frames: BiomechFrame[], fps: number): PhaseLagMs | undefined {
  const hoofs: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  const tds: Record<string, number[]> = {};
  for (const h of hoofs) tds[h] = touchdownTimes(frames, h);

  function avgLag(a: string, b: string): number | undefined {
    const ta = tds[a]; const tb = tds[b];
    if (!ta?.length || !tb?.length) return undefined;
    const lags: number[] = [];
    for (const tA of ta) {
      let minDiff = Infinity;
      for (const tB of tb) { const diff = Math.abs(tB - tA); if (diff < minDiff) minDiff = diff; }
      if (Number.isFinite(minDiff)) lags.push(minDiff * 1000);
    }
    return mean(lags);
  }

  const lf_rh = avgLag("lf_hoof", "rh_hoof");
  const rf_lh = avgLag("rf_hoof", "lh_hoof");
  const lf_lh = avgLag("lf_hoof", "lh_hoof");
  const rf_rh = avgLag("rf_hoof", "rh_hoof");
  if (lf_rh === undefined && rf_lh === undefined && lf_lh === undefined && rf_rh === undefined) return undefined;

  return {
    lf_rh: lf_rh !== undefined ? Math.round(lf_rh * 10) / 10 : undefined,
    rf_lh: rf_lh !== undefined ? Math.round(rf_lh * 10) / 10 : undefined,
    lf_lh: lf_lh !== undefined ? Math.round(lf_lh * 10) / 10 : undefined,
    rf_rh: rf_rh !== undefined ? Math.round(rf_rh * 10) / 10 : undefined,
  };
}

// ── Diagonal dissociation (Hobbs 2016) ──

function computeDiagonalDissociation(frames: BiomechFrame[], _fps: number): DiagonalDissociationMs | undefined {
  const lfTds = touchdownTimes(frames, "lf_hoof");
  const rhTds = touchdownTimes(frames, "rh_hoof");
  const rfTds = touchdownTimes(frames, "rf_hoof");
  const lhTds = touchdownTimes(frames, "lh_hoof");

  function diagDissoc(frontTds: number[], hindTds: number[]): number | undefined {
    if (!frontTds.length || !hindTds.length) return undefined;
    const diffs: number[] = [];
    for (const ft of frontTds) {
      let closest = Infinity; let bestDiff = 0;
      for (const ht of hindTds) { const d = Math.abs(ht - ft); if (d < closest) { closest = d; bestDiff = (ht - ft) * 1000; } }
      if (Number.isFinite(bestDiff)) diffs.push(Math.abs(bestDiff));
    }
    return mean(diffs);
  }

  const lf_rh = diagDissoc(lfTds, rhTds);
  const rf_lh = diagDissoc(rfTds, lhTds);
  if (lf_rh === undefined && rf_lh === undefined) return undefined;

  return {
    lf_rh: lf_rh !== undefined ? Math.round(lf_rh * 10) / 10 : undefined,
    rf_lh: rf_lh !== undefined ? Math.round(rf_lh * 10) / 10 : undefined,
  };
}

// ── Stride regularity (CV%) ──

function computeStrideRegularity(frames: BiomechFrame[]): StrideRegularity | undefined {
  const hoofs: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  const legNames = ["frontLeft", "frontRight", "hindLeft", "hindRight"];
  const perLeg: Record<string, number> = {};
  const cvValues: number[] = [];

  for (let i = 0; i < hoofs.length; i++) {
    const tds = touchdownTimes(frames, hoofs[i]);
    if (tds.length < 3) continue;
    const intervals: number[] = [];
    for (let j = 1; j < tds.length; j++) intervals.push(tds[j] - tds[j - 1]);
    const m = mean(intervals);
    const sd = stdev(intervals);
    if (m && sd && m > 0) {
      const cv = (sd / m) * 100;
      perLeg[legNames[i]] = Math.round(cv * 10) / 10;
      cvValues.push(cv);
    }
  }

  if (cvValues.length === 0) return undefined;

  const overall = Math.round((mean(cvValues) ?? 0) * 10) / 10;
  const rating: StrideRegularity["rating"] = overall < 10 ? "stable" : overall < 15 ? "moderate" : "irregular";

  return { perLeg, overall, rating };
}

// ── Head/Pelvis metrics ──

/**
 * Find local minima and maxima in a Y series (smoothed).
 * For head/pelvis Y: minima = highest point (Y-up=down in screen coords),
 * maxima = lowest point (ground-ward).
 */
function findPeaks(values: number[]): { minima: number[]; maxima: number[] } {
  const minima: number[] = [];
  const maxima: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] < values[i - 1] && values[i] < values[i + 1]) minima.push(values[i]);
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) maxima.push(values[i]);
  }
  return { minima, maxima };
}

/**
 * Compute Vertical Symmetry Index (Rhodin et al.)
 * VSI = |Dmax - Dmin| / (Dmax + Dmin) × 100
 * where Dmax/Dmin are mean absolute deviations at maxima/minima from the mean.
 */
function computeVSI(yValues: number[]): { vsi: number; reliable: boolean } | undefined {
  if (yValues.length < 10) return undefined;
  
  // Smooth first
  const smoothed = yValues; // already smoothed upstream
  const m = mean(smoothed);
  if (m === undefined) return undefined;
  
  const { minima, maxima } = findPeaks(smoothed);
  if (minima.length < 2 || maxima.length < 2) return { vsi: 0, reliable: false };
  
  // Displacement from mean at peaks
  const dMin = mean(minima.map(v => Math.abs(v - m))) ?? 0;
  const dMax = mean(maxima.map(v => Math.abs(v - m))) ?? 0;
  
  const denom = dMax + dMin;
  if (denom < 0.0001) return { vsi: 0, reliable: minima.length >= 3 && maxima.length >= 3 };
  
  const vsi = Math.round(Math.abs(dMax - dMin) / denom * 10000) / 100; // percentage
  const reliable = minima.length >= 3 && maxima.length >= 3;
  
  return { vsi, reliable };
}

/**
 * Map VSI to AAEP lameness grade (0-5 scale).
 * Based on Rhodin et al. thresholds:
 * VSI < 6% = grade 0 (sound)
 * VSI 6-12% = grade 1 (barely perceptible)
 * VSI 12-20% = grade 2 (difficult to observe consistently)
 * VSI 20-35% = grade 3 (consistently observable)
 * VSI 35-50% = grade 4 (obvious, marked head nod)
 * VSI > 50% = grade 5 (minimal weight bearing)
 */
function vsiToAAEPGrade(vsi: number): number {
  if (vsi < 6) return 0;
  if (vsi < 12) return 1;
  if (vsi < 20) return 2;
  if (vsi < 35) return 3;
  if (vsi < 50) return 4;
  return 5;
}

function computeHeadPelvisMetrics(frames: BiomechFrame[]): HeadPelvisMetrics {
  const headYRaw = seriesY(frames, "poll");
  const pelvisYRaw = seriesY(frames, "dock");
  const headY = headYRaw.filter((v): v is number => v !== undefined);
  const pelvisY = pelvisYRaw.filter((v): v is number => v !== undefined);

  const headVerticalROM = headY.length >= 2
    ? Math.round((Math.max(...headY) - Math.min(...headY)) * 10000) / 10000
    : undefined;

  const pelvisVerticalROM = pelvisY.length >= 2
    ? Math.round((Math.max(...pelvisY) - Math.min(...pelvisY)) * 10000) / 10000
    : undefined;

  // Asymmetry: compare upward peaks vs downward peaks
  let headVerticalAsymmetryIndex: number | undefined;
  if (headY.length >= 4) {
    const m = mean(headY)!;
    const ups = headY.filter((v) => v < m).map((v) => m - v);
    const downs = headY.filter((v) => v > m).map((v) => v - m);
    const upMean = mean(ups) ?? 0;
    const downMean = mean(downs) ?? 0;
    const denom = Math.max(upMean, downMean, 0.001);
    headVerticalAsymmetryIndex = Math.round((Math.abs(upMean - downMean) / denom) * 1000) / 1000;
  }

  // Phase lag between head and pelvis vertical movement
  let headPelvisPhaseLagMs: number | undefined;
  if (headY.length >= 3 && pelvisY.length >= 3 && frames.length >= 3) {
    const dt = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t) / (frames.length - 1) : 0;
    if (dt > 0) {
      const headSmoothed = sma(seriesY(frames, "poll"), 3);
      const pelvisSmoothed = sma(seriesY(frames, "dock"), 3);

      let headMinIdx = 0;
      let pelvisMinIdx = 0;
      let headMin = Infinity;
      let pelvisMin = Infinity;
      for (let i = 0; i < frames.length; i++) {
        const hv = headSmoothed[i];
        const pv = pelvisSmoothed[i];
        if (hv !== undefined && hv < headMin) { headMin = hv; headMinIdx = i; }
        if (pv !== undefined && pv < pelvisMin) { pelvisMin = pv; pelvisMinIdx = i; }
      }
      headPelvisPhaseLagMs = Math.round(Math.abs(headMinIdx - pelvisMinIdx) * dt * 1000 * 10) / 10;
    }
  }

  // VSI — Vertical Symmetry Index
  const headVSIResult = computeVSI(headY);
  const pelvisVSIResult = computeVSI(pelvisY);
  
  const headVSI = headVSIResult?.vsi;
  const pelvisVSI = pelvisVSIResult?.vsi;
  const vsiReliable = (headVSIResult?.reliable ?? false) || (pelvisVSIResult?.reliable ?? false);
  
  // Determine lameness grade from worst VSI
  let lamenessGrade: number | undefined;
  let lamenessLeg: "front" | "hind" | "both" | null = null;
  
  if (headVSI !== undefined || pelvisVSI !== undefined) {
    const hGrade = headVSI !== undefined ? vsiToAAEPGrade(headVSI) : 0;
    const pGrade = pelvisVSI !== undefined ? vsiToAAEPGrade(pelvisVSI) : 0;
    lamenessGrade = Math.max(hGrade, pGrade);
    
    if (hGrade > 0 && pGrade > 0) lamenessLeg = "both";
    else if (hGrade > 0) lamenessLeg = "front";
    else if (pGrade > 0) lamenessLeg = "hind";
  }

  return {
    headVerticalROM, pelvisVerticalROM, headPelvisPhaseLagMs, headVerticalAsymmetryIndex,
    headVSI, pelvisVSI, lamenessGrade, lamenessLeg, vsiReliable,
  };
}

// ── Back kinematics ──

function computeBackMetrics(frames: BiomechFrame[]): BackMetrics {
  const withersY = seriesY(frames, "withers").filter((v): v is number => v !== undefined);
  const dockY = seriesY(frames, "dock").filter((v): v is number => v !== undefined);

  // Withers-Croup vertical ROM difference
  const withersROM = withersY.length >= 2 ? Math.max(...withersY) - Math.min(...withersY) : undefined;
  const dockROM = dockY.length >= 2 ? Math.max(...dockY) - Math.min(...dockY) : undefined;
  const withersCroupROM = withersROM !== undefined && dockROM !== undefined
    ? Math.round(Math.abs(withersROM - dockROM) * 10000) / 10000
    : undefined;

  // Back slope ROM: change in slope angle from withers to croup across frames
  const slopes: number[] = [];
  for (const f of frames) {
    const w = f.points["withers"];
    const d = f.points["dock"];
    if (isFinitePoint(w) && isFinitePoint(d)) {
      const dx = d[0] - w[0];
      const dy = d[1] - w[1];
      if (Math.abs(dx) > 0.001) {
        slopes.push(Math.atan2(dy, dx) * (180 / Math.PI));
      }
    }
  }
  const backSlopeROM = slopes.length >= 2
    ? Math.round((Math.max(...slopes) - Math.min(...slopes)) * 100) / 100
    : undefined;

  // Lateral sway: ROM of pelvis (dock) X movement
  const dockX = seriesX(frames, "dock").filter((v): v is number => v !== undefined);
  const lateralSwayIndex = dockX.length >= 2
    ? Math.round((Math.max(...dockX) - Math.min(...dockX)) * 10000) / 10000
    : undefined;

  return { withersCroupROM, backSlopeROM, lateralSwayIndex };
}

// ── Data conversion ──

/** Convert KeypointsData[] (from detect-horse-keypoints) to BiomechFrame[] */
export function keypointsDataToFrames(keypoints: KeypointsData[], fps: number): BiomechFrame[] {
  const dt = 1 / fps;
  return keypoints.map((kp, i) => {
    const points: Record<string, Point2 | undefined> = {};

    // Map leg keypoints
    const legMap: Record<string, string> = {
      "frontLeft.hoof": "lf_hoof",
      "frontLeft.fetlock": "lf_fetlock",
      "frontLeft.carpus": "lf_carpus",
      "frontLeft.shoulder": "lf_shoulder",
      "frontRight.hoof": "rf_hoof",
      "frontRight.fetlock": "rf_fetlock",
      "frontRight.carpus": "rf_carpus",
      "frontRight.shoulder": "rf_shoulder",
      "hindLeft.hoof": "lh_hoof",
      "hindLeft.fetlock": "lh_fetlock",
      "hindLeft.stifle": "lh_stifle",
      "hindLeft.hip": "lh_hip",
      "hindRight.hoof": "rh_hoof",
      "hindRight.fetlock": "rh_fetlock",
      "hindRight.stifle": "rh_stifle",
      "hindRight.hip": "rh_hip",
    };

    for (const [path, name] of Object.entries(legMap)) {
      const [leg, joint] = path.split(".");
      const legData = (kp as any)[leg];
      if (legData?.[joint]) points[name] = legData[joint] as Point2;
    }

    // Body points
    const body = (kp as any).body;
    if (body) {
      if (body.withers) points["withers"] = body.withers as Point2;
      if (body.poll) points["poll"] = body.poll as Point2;
      if (body.dock) points["dock"] = body.dock as Point2;
      if (body.muzzle) points["muzzle"] = body.muzzle as Point2;
    }

    return { t: i * dt, points };
  });
}

// ── Main extraction ──

export function extractBiomechMetrics(input: BiomechInputSequence, breedId?: string): BiomechMetrics {
  const { frames, fps } = input;
  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];

  // Apply smoothing + anatomical constraints post-processing
  smoothKeypoints(frames, fps);

  const quality = computeQualityMetrics(frames, fps);
  const gait = classifyGaitWindowed(frames, fps, breedId);
  const phaseLagMs = computePhaseLags(frames, fps);
  const diagonalDissociationMs = computeDiagonalDissociation(frames, fps);
  const headPelvis = computeHeadPelvisMetrics(frames);
  const back = computeBackMetrics(frames);
  const strideRegularity = computeStrideRegularity(frames);

  // Expose contact events for visualization
  const contactEvents: Record<HoofName, FootContactEvent[]> = {
    lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
  };
  for (const hoof of hoofNames) {
    contactEvents[hoof] = detectFootContacts(frames, hoof);
  }

  // Hoof phase detection (stance/swing/occluded)
  const hoofPhaseResult = detectHoofPhase(frames, fps);

  // Expose windows for timeline visualization
  const windowSize = Math.max(10, Math.round(fps * 3));
  const step = Math.max(5, Math.round(windowSize * 0.5));
  const windows: GaitWindow[] = [];
  for (let start = 0; start + windowSize <= frames.length; start += step) {
    const end = start + windowSize;
    const windowFrames = frames.slice(start, end);
    const wContacts: Record<HoofName, FootContactEvent[]> = {
      lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
    };
    for (const hoof of hoofNames) wContacts[hoof] = detectFootContacts(windowFrames, hoof);
    const totalContacts = Object.values(wContacts).reduce((s, c) => s + c.length, 0);
    if (totalContacts < 4) continue;
    const features = computeGaitFeatures(windowFrames, fps, wContacts);
    const classification = classifyFromFeatures(features, breedId);
    const missingRate = computeMissingRateForWindow(windowFrames);
    const wQuality = clamp01(features.contactEventConfidence * (1 - missingRate));
    windows.push({
      startFrame: start, endFrame: end,
      startT: frames[start].t, endT: frames[end - 1].t,
      features, classification, quality: wQuality,
    });
  }

  // Camera motion analysis (Optical Flow Validation)
  const cameraMotion = analyzeCameraMotion(frames, fps);

  // GRF estimation from kinematics (Stage 6)
  const grfMetrics = estimateGRF(frames, fps, contactEvents, hoofPhaseResult.metrics);

  const result: BiomechMetrics = {
    quality,
    gait,
    timing: { phaseLagMs, diagonalDissociationMs },
    headPelvis,
    back,
    strideRegularity,
    contactEvents,
    windows,
    hoofPhases: hoofPhaseResult.sequence,
    stanceSwingMetrics: hoofPhaseResult.metrics,
    cameraMotion,
    grfMetrics,
  };

  return result;
}
