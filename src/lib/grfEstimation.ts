/**
 * Ground Reaction Force (GRF) Estimation from kinematics only.
 *
 * Uses simplified inverse dynamics: vertical acceleration of body segments
 * (withers, dock/pelvis) during stance phases to estimate peak GRF per limb.
 * Without force plates, we use kinematic proxies:
 *
 * 1. Vertical deceleration of the hoof at contact → impact force proxy
 * 2. Vertical acceleration of body COM during stance → loading force proxy
 * 3. Duty factor (stance/total) → sustained load indicator
 *
 * References:
 * [8] Bobbert & Santamaria (2005) — GRF estimation from kinematics
 * [9] Hobbs et al. (2016) — limb loading asymmetry in gaited horses
 */

import type {
  BiomechFrame,
  Point2,
  HoofName,
  FootContactEvent,
  StanceSwingMetrics,
  HoofPhaseSequence,
} from "@/types/biomech";
import { isFinitePoint, mean, stdev } from "./biomechanics";

// ── Types ──

export interface LimbGRF {
  /** Limb name */
  limb: HoofName;
  /** Peak impact force proxy (normalized 0..1, from hoof deceleration at contact) */
  peakImpact: number;
  /** Mean loading during stance (normalized 0..1, from body COM vertical accel) */
  meanStanceLoad: number;
  /** Time of peak GRF within stride cycle (0..1) */
  peakTimingNorm: number;
  /** Loading rate — how fast force builds (normalized units/s²) */
  loadingRate: number;
  /** Number of contacts used for estimation */
  contactCount: number;
}

export interface GRFMetrics {
  /** Per-limb GRF estimates */
  perLimb: Record<HoofName, LimbGRF>;
  /** Front/hind load distribution (0.5 = even; >0.5 = front-heavy) */
  frontHindRatio: number;
  /** Left/right asymmetry index (0 = symmetric; 1 = fully asymmetric) */
  leftRightAsymmetry: number;
  /** Overall peak force (max across limbs, normalized 0..1) */
  overallPeakForce: number;
  /** Whether any limb shows overload (>1.5 SD above mean) */
  overloadDetected: boolean;
  /** Limbs flagged for overload */
  overloadedLimbs: HoofName[];
  /** Reliability: enough contacts for meaningful estimates */
  reliable: boolean;
  /** Human-readable warnings */
  warnings: string[];
}

// ── Helpers ──

const HOOFS: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
const FRONT_HOOFS: HoofName[] = ["lf_hoof", "rf_hoof"];
const LEFT_HOOFS: HoofName[] = ["lf_hoof", "lh_hoof"];

/**
 * Compute vertical velocity series for a keypoint (Vy = dY/dt).
 * Returns array aligned to frames (first element = 0).
 */
function verticalVelocity(frames: BiomechFrame[], key: string, fps: number): (number | undefined)[] {
  const dt = 1 / fps;
  const result: (number | undefined)[] = [undefined];
  for (let i = 1; i < frames.length; i++) {
    const p0 = frames[i - 1].points[key];
    const p1 = frames[i].points[key];
    if (isFinitePoint(p0) && isFinitePoint(p1)) {
      result.push((p1[1] - p0[1]) / dt);
    } else {
      result.push(undefined);
    }
  }
  return result;
}

/**
 * Compute vertical acceleration (Ay = dVy/dt).
 */
function verticalAcceleration(vy: (number | undefined)[], fps: number): (number | undefined)[] {
  const dt = 1 / fps;
  const result: (number | undefined)[] = [undefined];
  for (let i = 1; i < vy.length; i++) {
    if (vy[i] !== undefined && vy[i - 1] !== undefined) {
      result.push((vy[i]! - vy[i - 1]!) / dt);
    } else {
      result.push(undefined);
    }
  }
  return result;
}

/**
 * Estimate body COM vertical acceleration from withers + dock average.
 */
function bodyCOMAcceleration(frames: BiomechFrame[], fps: number): (number | undefined)[] {
  const vyWithers = verticalVelocity(frames, "withers", fps);
  const vyDock = verticalVelocity(frames, "dock", fps);

  // Average Vy of withers and dock
  const vyCOM: (number | undefined)[] = [];
  for (let i = 0; i < frames.length; i++) {
    const w = vyWithers[i];
    const d = vyDock[i];
    if (w !== undefined && d !== undefined) {
      vyCOM.push((w + d) / 2);
    } else if (w !== undefined) {
      vyCOM.push(w);
    } else if (d !== undefined) {
      vyCOM.push(d);
    } else {
      vyCOM.push(undefined);
    }
  }

  return verticalAcceleration(vyCOM, fps);
}

/**
 * Get frames near a contact event (±window around contact frame index).
 */
function getStanceWindow(
  contactFrameIdx: number,
  totalFrames: number,
  fps: number,
  dutyFactor: number,
): { start: number; end: number } {
  // Stance duration ≈ dutyFactor * stride duration
  // Approximate stride at ~1.4 Hz
  const strideDurationFrames = Math.round(fps / 1.4);
  const stanceFrames = Math.max(3, Math.round(strideDurationFrames * dutyFactor));
  const half = Math.floor(stanceFrames / 2);
  return {
    start: Math.max(0, contactFrameIdx - Math.floor(half * 0.3)), // contact is near start of stance
    end: Math.min(totalFrames - 1, contactFrameIdx + stanceFrames),
  };
}

// ── Main export ──

export function estimateGRF(
  frames: BiomechFrame[],
  fps: number,
  contactEvents: Record<HoofName, FootContactEvent[]>,
  stanceSwingMetrics?: StanceSwingMetrics,
): GRFMetrics {
  const warnings: string[] = [];

  if (frames.length < 10) {
    return emptyGRFMetrics(["too_few_frames"]);
  }

  // Precompute body COM acceleration
  const comAy = bodyCOMAcceleration(frames, fps);

  const limbResults: Record<HoofName, LimbGRF> = {} as any;

  for (const hoof of HOOFS) {
    const contacts = contactEvents[hoof] || [];
    const dutyFactor = stanceSwingMetrics?.perHoof?.[hoof]?.dutyFactor ?? 0.6;

    if (contacts.length < 2) {
      limbResults[hoof] = {
        limb: hoof,
        peakImpact: 0,
        meanStanceLoad: 0,
        peakTimingNorm: 0,
        loadingRate: 0,
        contactCount: contacts.length,
      };
      continue;
    }

    // Hoof vertical velocity for impact estimation
    const hoofVy = verticalVelocity(frames, hoof, fps);
    const hoofAy = verticalAcceleration(hoofVy, fps);

    const peakImpacts: number[] = [];
    const stanceLoads: number[] = [];
    const peakTimings: number[] = [];
    const loadingRates: number[] = [];

    for (const contact of contacts) {
      const idx = contact.frameIndex;
      if (idx < 1 || idx >= frames.length - 1) continue;

      // 1. Peak impact = magnitude of hoof deceleration at contact
      const ay = hoofAy[idx];
      if (ay !== undefined) {
        // Negative Ay (decelerating downward) = impact
        peakImpacts.push(Math.abs(ay));
      }

      // 2. Mean loading during stance window from body COM
      const sw = getStanceWindow(idx, frames.length, fps, dutyFactor);
      const stanceAccels: number[] = [];
      for (let j = sw.start; j <= sw.end; j++) {
        const a = comAy[j];
        if (a !== undefined) stanceAccels.push(Math.abs(a));
      }
      if (stanceAccels.length > 0) {
        stanceLoads.push(stanceAccels.reduce((s, v) => s + v, 0) / stanceAccels.length);
      }

      // 3. Peak timing within stride
      // Estimate stride from contact-to-contact interval
      const contactIdx = contacts.indexOf(contact);
      if (contactIdx < contacts.length - 1) {
        const nextContact = contacts[contactIdx + 1];
        const strideDuration = nextContact.frameIndex - idx;
        if (strideDuration > 0) {
          // Peak GRF typically occurs ~30-40% into stance
          const peakFrame = Math.round(idx + strideDuration * dutyFactor * 0.35);
          peakTimings.push((peakFrame - idx) / strideDuration);
        }
      }

      // 4. Loading rate — slope of force buildup (first 3 frames after contact)
      const buildupAccels: number[] = [];
      for (let j = idx; j < Math.min(idx + 4, frames.length); j++) {
        const a = comAy[j];
        if (a !== undefined) buildupAccels.push(Math.abs(a));
      }
      if (buildupAccels.length >= 2) {
        const rate = (buildupAccels[buildupAccels.length - 1] - buildupAccels[0]) / (buildupAccels.length / fps);
        loadingRates.push(Math.abs(rate));
      }
    }

    limbResults[hoof] = {
      limb: hoof,
      peakImpact: mean(peakImpacts) ?? 0,
      meanStanceLoad: mean(stanceLoads) ?? 0,
      peakTimingNorm: mean(peakTimings) ?? 0.35,
      loadingRate: mean(loadingRates) ?? 0,
      contactCount: contacts.length,
    };
  }

  // Normalize all values to 0..1 range based on max across limbs
  const allPeaks = HOOFS.map(h => limbResults[h].peakImpact).filter(v => v > 0);
  const allLoads = HOOFS.map(h => limbResults[h].meanStanceLoad).filter(v => v > 0);
  const maxPeak = allPeaks.length ? Math.max(...allPeaks) : 1;
  const maxLoad = allLoads.length ? Math.max(...allLoads) : 1;

  for (const hoof of HOOFS) {
    if (maxPeak > 0) limbResults[hoof].peakImpact = Math.min(1, limbResults[hoof].peakImpact / maxPeak);
    if (maxLoad > 0) limbResults[hoof].meanStanceLoad = Math.min(1, limbResults[hoof].meanStanceLoad / maxLoad);
    // Normalize loading rate similarly
    limbResults[hoof].loadingRate = Math.min(1, limbResults[hoof].loadingRate / Math.max(1, maxPeak * fps));
  }

  // Front/hind ratio
  const frontLoad = mean(FRONT_HOOFS.map(h => limbResults[h].meanStanceLoad)) ?? 0;
  const hindLoad = mean(HOOFS.filter(h => !FRONT_HOOFS.includes(h)).map(h => limbResults[h].meanStanceLoad)) ?? 0;
  const totalLoad = frontLoad + hindLoad;
  const frontHindRatio = totalLoad > 0 ? frontLoad / totalLoad : 0.5;

  // Left/right asymmetry
  const leftLoad = mean(LEFT_HOOFS.map(h => limbResults[h].peakImpact)) ?? 0;
  const rightLoad = mean(HOOFS.filter(h => !LEFT_HOOFS.includes(h)).map(h => limbResults[h].peakImpact)) ?? 0;
  const lrTotal = leftLoad + rightLoad;
  const leftRightAsymmetry = lrTotal > 0 ? Math.abs(leftLoad - rightLoad) / lrTotal : 0;

  // Overload detection: any limb >1.5 SD above mean peak
  const peakValues = HOOFS.map(h => limbResults[h].peakImpact);
  const peakMean = mean(peakValues) ?? 0;
  const peakStd = stdev(peakValues) ?? 0;
  const overloadThreshold = peakMean + 1.5 * peakStd;
  const overloadedLimbs = HOOFS.filter(h => limbResults[h].peakImpact > overloadThreshold && peakStd > 0.05);

  if (overloadedLimbs.length > 0) {
    warnings.push("overload_detected");
  }
  if (frontHindRatio > 0.65) {
    warnings.push("front_heavy");
  }
  if (leftRightAsymmetry > 0.25) {
    warnings.push("lateral_asymmetry");
  }

  const totalContacts = HOOFS.reduce((s, h) => s + limbResults[h].contactCount, 0);
  const reliable = totalContacts >= 8;

  if (!reliable) {
    warnings.push("low_contact_count");
  }

  return {
    perLimb: limbResults,
    frontHindRatio: Math.round(frontHindRatio * 100) / 100,
    leftRightAsymmetry: Math.round(leftRightAsymmetry * 100) / 100,
    overallPeakForce: Math.max(...HOOFS.map(h => limbResults[h].peakImpact)),
    overloadDetected: overloadedLimbs.length > 0,
    overloadedLimbs,
    reliable,
    warnings,
  };
}

function emptyGRFMetrics(warnings: string[]): GRFMetrics {
  const emptyLimb = (hoof: HoofName): LimbGRF => ({
    limb: hoof,
    peakImpact: 0,
    meanStanceLoad: 0,
    peakTimingNorm: 0,
    loadingRate: 0,
    contactCount: 0,
  });
  return {
    perLimb: {
      lf_hoof: emptyLimb("lf_hoof"),
      rf_hoof: emptyLimb("rf_hoof"),
      lh_hoof: emptyLimb("lh_hoof"),
      rh_hoof: emptyLimb("rh_hoof"),
    },
    frontHindRatio: 0.5,
    leftRightAsymmetry: 0,
    overallPeakForce: 0,
    overloadDetected: false,
    overloadedLimbs: [],
    reliable: false,
    warnings,
  };
}
