/**
 * Stride Segmentation — detects individual strides from hoof contact events
 * and computes per-stride biomechanical metrics + consistency scores.
 *
 * References:
 * - Shaffer et al. 2025: Markerless Full-Body Biomechanics
 * - Hildebrand 1965: Symmetrical gaits of horses
 * - Rhodin et al.: Phase lag measurement methodology
 */

import type {
  BiomechFrame,
  HoofName,
  HoofPhaseSequence,
} from "@/types/biomech";
import type {
  Stride,
  StrideMetrics,
  StrideConsistency,
  StrideSegmentationResult,
} from "@/types/stride";
import { detectFootContacts, seriesY, butterworthLowPass, mean, stdev } from "@/lib/biomechanics";

const MIN_STRIDES_RELIABLE = 3;
const MIN_STRIDE_DURATION_MS = 200;   // physical minimum
const MAX_STRIDE_DURATION_MS = 2500;  // physical maximum (slow walk)

/**
 * Select the best reference hoof for stride segmentation.
 * Picks the hoof with the most reliable contact events.
 */
function selectReferenceHoof(
  frames: BiomechFrame[],
): { hoof: HoofName; contactCount: number } {
  const hooves: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  let bestHoof: HoofName = "lf_hoof";
  let bestCount = 0;

  for (const hoof of hooves) {
    const contacts = detectFootContacts(frames, hoof);
    const highConfContacts = contacts.filter(c => c.confidence >= 0.4);
    if (highConfContacts.length > bestCount) {
      bestCount = highConfContacts.length;
      bestHoof = hoof;
    }
  }

  return { hoof: bestHoof, contactCount: bestCount };
}

/**
 * Segment strides from a reference hoof's contact events.
 * Each stride = interval between consecutive contacts of the same hoof.
 */
function segmentStrides(
  frames: BiomechFrame[],
  referenceHoof: HoofName,
  fps: number,
  hoofPhases?: HoofPhaseSequence,
): Stride[] {
  const contacts = detectFootContacts(frames, referenceHoof)
    .filter(c => c.confidence >= 0.35)
    .sort((a, b) => a.frameIndex - b.frameIndex);

  if (contacts.length < 2) return [];

  const strides: Stride[] = [];
  const dt = fps > 0 ? 1 / fps : 1 / 30;

  for (let i = 0; i < contacts.length - 1; i++) {
    const start = contacts[i];
    const end = contacts[i + 1];
    const durationMs = (end.t - start.t) * 1000;

    // Filter physically implausible strides
    if (durationMs < MIN_STRIDE_DURATION_MS || durationMs > MAX_STRIDE_DURATION_MS) continue;

    // Compute stance/swing from hoof phase data if available
    let stanceMs = 0;
    let swingMs = 0;

    if (hoofPhases) {
      const phases = hoofPhases.perHoof[referenceHoof];
      if (phases && phases.length > 0) {
        let stanceFrames = 0;
        let swingFrames = 0;
        for (let f = start.frameIndex; f < end.frameIndex && f < phases.length; f++) {
          if (phases[f] === "stance") stanceFrames++;
          else if (phases[f] === "swing") swingFrames++;
        }
        const totalActive = stanceFrames + swingFrames;
        if (totalActive > 0) {
          stanceMs = (stanceFrames * dt * 1000);
          swingMs = (swingFrames * dt * 1000);
        }
      }
    }

    // Fallback: estimate from Y position if phases unavailable
    if (stanceMs === 0 && swingMs === 0) {
      const yVals = seriesY(frames, referenceHoof);
      const smoothedY = butterworthLowPass(yVals, 12, fps);
      const defined = smoothedY
        .slice(start.frameIndex, end.frameIndex)
        .filter((v): v is number => v !== undefined);

      if (defined.length > 2) {
        const maxY = Math.max(...defined);
        const minY = Math.min(...defined);
        const range = maxY - minY;
        const groundThreshold = maxY - range * 0.25;

        let stanceCount = 0;
        for (let f = start.frameIndex; f < end.frameIndex; f++) {
          const y = smoothedY[f];
          if (y !== undefined && y >= groundThreshold) stanceCount++;
        }
        const totalFrames = end.frameIndex - start.frameIndex;
        stanceMs = (stanceCount / totalFrames) * durationMs;
        swingMs = durationMs - stanceMs;
      } else {
        // Last resort: assume typical duty cycle
        stanceMs = durationMs * 0.6;
        swingMs = durationMs * 0.4;
      }
    }

    const dutyCycle = durationMs > 0 ? stanceMs / durationMs : 0;
    const frequencyHz = durationMs > 0 ? 1000 / durationMs : 0;
    const confidence = (start.confidence + end.confidence) / 2;

    strides.push({
      index: strides.length,
      referenceHoof,
      startFrame: start.frameIndex,
      endFrame: end.frameIndex,
      startT: start.t,
      endT: end.t,
      durationMs: Math.round(durationMs),
      stanceMs: Math.round(stanceMs),
      swingMs: Math.round(swingMs),
      dutyCycle: Math.round(dutyCycle * 1000) / 1000,
      frequencyHz: Math.round(frequencyHz * 100) / 100,
      confidence: Math.round(confidence * 1000) / 1000,
    });
  }

  return strides;
}

/**
 * Compute per-stride metrics for all 4 hooves within each stride window.
 */
function computeStrideMetrics(
  strides: Stride[],
  frames: BiomechFrame[],
  fps: number,
  hoofPhases?: HoofPhaseSequence,
): StrideMetrics[] {
  const hooves: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  const dt = fps > 0 ? 1 / fps : 1 / 30;

  return strides.map((stride) => {
    const perHoof: StrideMetrics["perHoof"] = {};
    let hoofDataCount = 0;

    for (const hoof of hooves) {
      if (hoofPhases) {
        const phases = hoofPhases.perHoof[hoof];
        if (phases && phases.length > 0) {
          let stanceFrames = 0;
          let swingFrames = 0;
          for (let f = stride.startFrame; f < stride.endFrame && f < phases.length; f++) {
            if (phases[f] === "stance") stanceFrames++;
            else if (phases[f] === "swing") swingFrames++;
          }
          const totalActive = stanceFrames + swingFrames;
          if (totalActive >= 2) {
            const stanceMs = Math.round(stanceFrames * dt * 1000);
            const swingMs = Math.round(swingFrames * dt * 1000);
            const total = stanceMs + swingMs;
            perHoof[hoof] = {
              stanceMs,
              swingMs,
              dutyCycle: total > 0 ? Math.round((stanceMs / total) * 1000) / 1000 : 0,
            };
            hoofDataCount++;
          }
        }
      } else {
        // Estimate from Y position
        const yVals = seriesY(frames, hoof);
        const smoothedY = butterworthLowPass(yVals, 12, fps);
        const slice = smoothedY.slice(stride.startFrame, stride.endFrame);
        const defined = slice.filter((v): v is number => v !== undefined);

        if (defined.length >= 3) {
          const maxY = Math.max(...defined);
          const minY = Math.min(...defined);
          const range = maxY - minY;
          if (range > 0.003) {
            const groundThreshold = maxY - range * 0.25;
            let stanceCount = 0;
            for (const y of slice) {
              if (y !== undefined && y >= groundThreshold) stanceCount++;
            }
            const totalFrames = stride.endFrame - stride.startFrame;
            const stanceMs = Math.round((stanceCount / totalFrames) * stride.durationMs);
            const swingMs = stride.durationMs - stanceMs;
            perHoof[hoof] = {
              stanceMs,
              swingMs,
              dutyCycle: stride.durationMs > 0 ? Math.round((stanceMs / stride.durationMs) * 1000) / 1000 : 0,
            };
            hoofDataCount++;
          }
        }
      }
    }

    return { stride, perHoof, hoofDataCount };
  });
}

/**
 * Compute aggregated stride consistency metrics (CV%).
 */
function computeConsistency(
  strides: Stride[],
  referenceHoof: HoofName,
): StrideConsistency {
  const durations = strides.map(s => s.durationMs);
  const stances = strides.map(s => s.stanceMs);
  const swings = strides.map(s => s.swingMs);
  const duties = strides.map(s => s.dutyCycle);
  const freqs = strides.map(s => s.frequencyHz);

  const cv = (arr: number[]): number => {
    const m = mean(arr);
    const s = stdev(arr);
    if (m === undefined || s === undefined || m === 0) return 0;
    return Math.round((s / m) * 10000) / 100; // CV as percentage
  };

  const durationCV = cv(durations);
  const stanceCV = cv(stances);
  const swingCV = cv(swings);
  const dutyCycleCV = cv(duties);

  // Overall score: weighted average of inverse CVs
  // Lower CV = better consistency
  const avgCV = (durationCV + stanceCV + swingCV + dutyCycleCV) / 4;
  let score: number;
  let rating: StrideConsistency["rating"];

  if (avgCV < 5) {
    score = Math.round(100 - avgCV * 2);
    rating = "excellent";
  } else if (avgCV < 10) {
    score = Math.round(85 - (avgCV - 5) * 3);
    rating = "good";
  } else if (avgCV < 15) {
    score = Math.round(60 - (avgCV - 10) * 2);
    rating = "moderate";
  } else {
    score = Math.max(10, Math.round(40 - (avgCV - 15)));
    rating = "poor";
  }

  return {
    strideCount: strides.length,
    referenceHoof,
    meanDurationMs: Math.round(mean(durations) ?? 0),
    durationCV,
    meanStanceMs: Math.round(mean(stances) ?? 0),
    stanceCV,
    meanSwingMs: Math.round(mean(swings) ?? 0),
    swingCV,
    meanDutyCycle: Math.round((mean(duties) ?? 0) * 1000) / 1000,
    dutyCycleCV,
    meanFrequencyHz: Math.round((mean(freqs) ?? 0) * 100) / 100,
    score: Math.max(0, Math.min(100, score)),
    rating,
  };
}

/**
 * Main entry point: segment strides and compute all metrics.
 */
export function segmentAndAnalyzeStrides(
  frames: BiomechFrame[],
  fps: number,
  hoofPhases?: HoofPhaseSequence,
): StrideSegmentationResult {
  // 1. Select best reference hoof
  const { hoof: referenceHoof } = selectReferenceHoof(frames);

  // 2. Segment strides
  const strides = segmentStrides(frames, referenceHoof, fps, hoofPhases);

  // 3. Compute per-stride metrics
  const strideMetrics = computeStrideMetrics(strides, frames, fps, hoofPhases);

  // 4. Compute consistency
  const consistency = strides.length >= 2
    ? computeConsistency(strides, referenceHoof)
    : {
        strideCount: strides.length,
        referenceHoof,
        meanDurationMs: strides[0]?.durationMs ?? 0,
        durationCV: 0,
        meanStanceMs: strides[0]?.stanceMs ?? 0,
        stanceCV: 0,
        meanSwingMs: strides[0]?.swingMs ?? 0,
        swingCV: 0,
        meanDutyCycle: strides[0]?.dutyCycle ?? 0,
        dutyCycleCV: 0,
        meanFrequencyHz: strides[0]?.frequencyHz ?? 0,
        score: 0,
        rating: "poor" as const,
      };

  return {
    strides,
    strideMetrics,
    consistency,
    reliable: strides.length >= MIN_STRIDES_RELIABLE,
    minStridesRequired: MIN_STRIDES_RELIABLE,
  };
}
