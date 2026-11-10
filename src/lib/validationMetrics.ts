/**
 * Quantitative validation KPIs for biomechanical analysis.
 * 
 * Provides internal accuracy metrics without external ground truth:
 * - Inter-window agreement (precision-recall proxy)
 * - Contact detection consistency (RMSE of stride intervals)
 * - Keypoint temporal stability
 * - Anatomical violation rate
 * - Bland-Altman self-check (first half vs second half)
 * 
 * References:
 * [6] PFERD dataset (Nature Scientific Data)
 * [7] EKGA pipeline (Niknejad et al., ASABE)
 */

import type {
  BiomechFrame,
  BiomechMetrics,
  GaitWindow,
  HoofName,
  ValidationReport,
} from "@/types/biomech";
import { mean, stdev, isFinitePoint, detectFootContacts } from "./biomechanics";

/**
 * Compute inter-window classification agreement.
 * Returns fraction of quality windows that agree with majority vote.
 */
function computeInterWindowAgreement(windows: GaitWindow[]): number {
  const qualityWindows = windows.filter(w => w.quality >= 0.4);
  if (qualityWindows.length < 2) return 1; // single window = 100% agreement

  const votes: Record<string, number> = {};
  for (const w of qualityWindows) {
    const cls = w.classification.classification;
    votes[cls] = (votes[cls] || 0) + 1;
  }

  let majorityCount = 0;
  for (const count of Object.values(votes)) {
    if (count > majorityCount) majorityCount = count;
  }

  return majorityCount / qualityWindows.length;
}

/**
 * Compute RMSE of stride intervals across windows.
 * Lower = more consistent contact detection.
 */
function computeContactConsistencyRMSE(
  frames: BiomechFrame[],
  windows: GaitWindow[],
  fps: number,
): number {
  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
  const allIntervals: number[][] = []; // per-window stride intervals

  const windowSize = Math.max(10, Math.round(fps * 3));
  const step = Math.max(5, Math.round(windowSize * 0.5));

  for (let wIdx = 0; wIdx < Math.min(windows.length, 10); wIdx++) {
    const start = wIdx * step;
    const end = Math.min(start + windowSize, frames.length);
    if (end - start < 10) continue;

    const windowFrames = frames.slice(start, end);
    const intervals: number[] = [];

    for (const hoof of hoofNames) {
      const contacts = detectFootContacts(windowFrames, hoof);
      for (let i = 1; i < contacts.length; i++) {
        intervals.push((contacts[i].t - contacts[i - 1].t) * 1000); // ms
      }
    }

    if (intervals.length > 0) allIntervals.push(intervals);
  }

  if (allIntervals.length < 2) return 0;

  // Compute mean interval per window, then RMSE across windows
  const windowMeans = allIntervals
    .map(ints => mean(ints))
    .filter((m): m is number => m !== undefined);

  if (windowMeans.length < 2) return 0;

  const globalMean = mean(windowMeans)!;
  const sumSqDiff = windowMeans.reduce((s, m) => s + (m - globalMean) ** 2, 0);
  return Math.sqrt(sumSqDiff / windowMeans.length);
}

/**
 * Compute mean frame-to-frame keypoint displacement.
 * Lower = more temporally stable keypoints.
 */
function computeKeypointTemporalStability(frames: BiomechFrame[]): number {
  if (frames.length < 2) return 0;

  const displacements: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];

    for (const key of Object.keys(curr.points)) {
      const p0 = prev.points[key];
      const p1 = curr.points[key];
      if (isFinitePoint(p0) && isFinitePoint(p1)) {
        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        displacements.push(Math.sqrt(dx * dx + dy * dy));
      }
    }
  }

  return mean(displacements) ?? 0;
}

/**
 * Compute fraction of frames with anatomical constraint violations.
 */
function computeAnatomicalViolationRate(frames: BiomechFrame[]): number {
  if (frames.length === 0) return 0;

  let violatedFrames = 0;
  for (const f of frames) {
    if (f.constraintViolations && f.constraintViolations.length > 0) {
      violatedFrames++;
    }
  }

  return violatedFrames / frames.length;
}

/**
 * Bland-Altman self-check: compare biomech metrics between
 * first half and second half of the sequence.
 * Returns bias (mean difference) and limits of agreement (1.96 * SD).
 */
function computeBlandAltmanSelfCheck(
  frames: BiomechFrame[],
  fps: number,
): { bias: number; loa: number } {
  if (frames.length < 20) return { bias: 0, loa: 0 };

  const mid = Math.floor(frames.length / 2);
  const firstHalf = frames.slice(0, mid);
  const secondHalf = frames.slice(mid);

  const hoofNames: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];

  // Compare stride intervals between halves
  const getIntervals = (slice: BiomechFrame[]): number[] => {
    const intervals: number[] = [];
    for (const hoof of hoofNames) {
      const contacts = detectFootContacts(slice, hoof);
      for (let i = 1; i < contacts.length; i++) {
        intervals.push((contacts[i].t - contacts[i - 1].t) * 1000);
      }
    }
    return intervals;
  };

  const first = getIntervals(firstHalf);
  const second = getIntervals(secondHalf);

  const firstMean = mean(first);
  const secondMean = mean(second);

  if (firstMean === undefined || secondMean === undefined) return { bias: 0, loa: 0 };

  // Pair-wise differences (use means as a simple Bland-Altman analog)
  const diff = firstMean - secondMean;
  const diffs = [diff]; // In production with more windows, this would be per-window pairs

  // For single-pair, use CV as proxy for LoA
  const combinedSD = stdev([...first, ...second]) ?? 0;
  const loa = 1.96 * combinedSD;

  return { bias: Math.abs(diff), loa };
}

/**
 * Generate a full ValidationReport for the biomechanical analysis.
 */
export function computeValidationReport(
  frames: BiomechFrame[],
  fps: number,
  metrics: BiomechMetrics,
): ValidationReport {
  const windows = metrics.windows ?? [];

  const interWindowAgreement = computeInterWindowAgreement(windows);
  const contactConsistencyRMSE = computeContactConsistencyRMSE(frames, windows, fps);
  const keypointTemporalStability = computeKeypointTemporalStability(frames);
  const anatomicalViolationRate = computeAnatomicalViolationRate(frames);
  const blandAltman = computeBlandAltmanSelfCheck(frames, fps);

  // Composite quality score (0-100)
  let score = 100;
  // Penalize low agreement
  score -= (1 - interWindowAgreement) * 30;
  // Penalize high stride RMSE (>50ms is bad)
  score -= Math.min(30, (contactConsistencyRMSE / 50) * 30);
  // Penalize temporal instability (>0.05 normalized displacement is bad)
  score -= Math.min(15, (keypointTemporalStability / 0.05) * 15);
  // Penalize anatomical violations
  score -= anatomicalViolationRate * 15;
  // Penalize Bland-Altman bias (>30ms is concerning)
  score -= Math.min(10, (blandAltman.bias / 30) * 10);

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    interWindowAgreement: Math.round(interWindowAgreement * 1000) / 1000,
    contactConsistencyRMSE: Math.round(contactConsistencyRMSE * 10) / 10,
    keypointTemporalStability: Math.round(keypointTemporalStability * 10000) / 10000,
    anatomicalViolationRate: Math.round(anatomicalViolationRate * 1000) / 1000,
    blandAltmanBias: Math.round(blandAltman.bias * 10) / 10,
    blandAltmanLoA: Math.round(blandAltman.loa * 10) / 10,
    overallQualityScore: score,
  };
}
