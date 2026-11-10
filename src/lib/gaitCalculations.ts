import type { Keypoint, KeypointsData, JointIssue } from "@/types/gait";

// Constants
export const LEG_COLORS: Record<string, string> = {
  frontLeft: "#22c55e",
  frontRight: "#3b82f6",
  hindLeft: "#f59e0b",
  hindRight: "#a855f7",
};

export const LEG_LABELS: Record<string, string> = {
  frontLeft: "קדמית שמאל",
  frontRight: "קדמית ימין",
  hindLeft: "אחורית שמאל",
  hindRight: "אחורית ימין",
};

export const LEG_LABELS_SHORT: Record<string, string> = {
  frontLeft: "קד-ש",
  frontRight: "קד-י",
  hindLeft: "אח-ש",
  hindRight: "אח-י",
};

export const NORMAL_RANGES: Record<string, [number, number]> = {
  fetlock: [135, 160],
  carpus: [170, 185],
  shoulder: [80, 110],
  stifle: [140, 165],
  hip: [80, 110],
};

export const GAIT_PHASE_OFFSETS: Record<string, number> = {
  frontLeft: 0,
  hindLeft: 0.15,
  frontRight: 0.5,
  hindRight: 0.65,
};

/**
 * Research-based phase profiles for gaited horses.
 * 
 * Singlefoot / True four-beat lateral gait:
 *   - Limb phasing ≈ 0.25 (evenly spaced beats) — Vincelette 2023, MDPI Animals
 *   - Lateral sequence: LH → LF → RH → RF
 *   - Each limb lifts off ~25% of cycle after the previous (perfect 4-beat)
 *   - Key quality indicator: evenness of inter-beat intervals
 * 
 * Broken Pace:
 *   - Lateral couplets with small dissociation (15-20% instead of 25%)
 *   - Hind leads front by shorter interval than singlefoot
 * 
 * References:
 *   - Vincelette 2023: "Alternative Lateral Horse Gaits" MDPI Animals 13(16)
 *   - Nicodemus & Clayton 2003: "Temporal variables of four-beat lateral gaits"
 *   - Hobbs et al. 2016: Biomechanical metrics for gaited horses
 *   - Rhodin et al.: Phase lag measurement methodology
 */
export const GAIT_PHASE_PROFILES: Record<string, Record<string, number>> = {
  // Walk: 4-beat lateral sequence LH→LF→RH→RF (Hildebrand 1965)
  walk:         { hindLeft: 0, frontLeft: 0.25, hindRight: 0.5, frontRight: 0.75 },
  trot:         { frontLeft: 0, hindRight: 0, frontRight: 0.5, hindLeft: 0.5 },
  diagonal:     { frontLeft: 0, hindRight: 0, frontRight: 0.5, hindLeft: 0.5 },
  pace:         { frontLeft: 0, hindLeft: 0, frontRight: 0.5, hindRight: 0.5 },
  lateral:      { frontLeft: 0, hindLeft: 0, frontRight: 0.5, hindRight: 0.5 },
  // Singlefoot: perfect 4-beat lateral sequence LH→LF→RH→RF (0.25 spacing)
  singlefoot:   { hindLeft: 0, frontLeft: 0.25, hindRight: 0.5, frontRight: 0.75 },
  // Broken pace: lateral couplets, hind leads front by ~15% (not full 25%)
  broken_pace:  { hindLeft: 0, frontLeft: 0.15, hindRight: 0.5, frontRight: 0.65 },
  four_beat:    { hindLeft: 0, frontLeft: 0.25, hindRight: 0.5, frontRight: 0.75 },
  // Icelandic tölt: 4-beat lateral, hind leads
  tolt:         { hindLeft: 0, frontLeft: 0.25, hindRight: 0.5, frontRight: 0.75 },
  tölt:         { hindLeft: 0, frontLeft: 0.25, hindRight: 0.5, frontRight: 0.75 },
  // Tennessee Walking Horse running walk: slight lateral lead, overstride
  running_walk: { hindLeft: 0, frontLeft: 0.2, hindRight: 0.5, frontRight: 0.7 },
  // Rack (Saddlebred): 4-beat even, high action
  rack:         { hindLeft: 0, frontLeft: 0.25, hindRight: 0.5, frontRight: 0.75 },
  // Fox trot: front walks, hind trots — diagonal with slide
  fox_trot:     { frontLeft: 0, hindRight: 0.1, frontRight: 0.5, hindLeft: 0.6 },
  foxtrot:      { frontLeft: 0, hindRight: 0.1, frontRight: 0.5, hindLeft: 0.6 },
  // Paso gaits
  paso_fino:    { hindLeft: 0, frontLeft: 0.22, hindRight: 0.5, frontRight: 0.72 },
  paso_largo:   { hindLeft: 0, frontLeft: 0.2, hindRight: 0.5, frontRight: 0.7 },
  paso_corto:   { hindLeft: 0, frontLeft: 0.25, hindRight: 0.5, frontRight: 0.75 },
  default:      { frontLeft: 0, hindLeft: 0.15, frontRight: 0.5, hindRight: 0.65 },
};

/** 
 * Singlefoot quality metrics — research-based criteria for evaluating 
 * four-beat gait quality (Vincelette 2023, Nicodemus & Clayton 2003)
 */
export interface SinglefootQualityMetrics {
  /** Inter-beat interval evenness (0-100, 100 = perfect 25% spacing) */
  beatEvenness: number;
  /** Lateral dissociation in ms (time between hind and fore on same side) */
  lateralDissociationMs: number;
  /** Whether the gait shows true singlefoot (each hoof lands independently) */
  isTrueSinglefoot: boolean;
  /** Overstride distance — hind hoof lands ahead of front hoof print */
  overstrideQuality: "none" | "slight" | "moderate" | "full";
  /** Head nod smoothness (less nod = better singlefoot quality) */
  headNodScore: number;
  /** Quality tier based on combined metrics */
  qualityTier: "premium" | "good" | "developing" | "rough";
  /** Description in Hebrew */
  description: string;
}

/** Evaluate singlefoot quality from analysis data */
export function evaluateSinglefootQuality(
  beatPattern?: string,
  lateralSync?: number,
  rhythmRegularity?: number,
  overreachDistance?: number | null,
  phaseLagMs?: { LH_LF?: number; RH_RF?: number; LF_RH?: number; RF_LH?: number }
): SinglefootQualityMetrics {
  // Calculate beat evenness from phase lags
  let beatEvenness = 75;
  let lateralDissociationMs = 0;

  if (phaseLagMs) {
    const lags = [phaseLagMs.LH_LF, phaseLagMs.RH_RF, phaseLagMs.LF_RH, phaseLagMs.RF_LH].filter(
      (v): v is number => v !== undefined
    );
    if (lags.length >= 2) {
      const avg = lags.reduce((a, b) => a + b, 0) / lags.length;
      const variance = lags.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / lags.length;
      const cv = Math.sqrt(variance) / (avg || 1);
      beatEvenness = Math.max(0, Math.min(100, Math.round(100 * (1 - cv * 2))));
    }
    lateralDissociationMs = ((phaseLagMs.LH_LF ?? 0) + (phaseLagMs.RH_RF ?? 0)) / 2;
  } else if (rhythmRegularity) {
    beatEvenness = rhythmRegularity;
  }

  const isTrueSinglefoot = beatEvenness >= 70 && (lateralSync ?? 50) < 80;

  let overstrideQuality: SinglefootQualityMetrics["overstrideQuality"] = "none";
  if (overreachDistance !== null && overreachDistance !== undefined) {
    if (overreachDistance > 15) overstrideQuality = "full";
    else if (overreachDistance > 8) overstrideQuality = "moderate";
    else if (overreachDistance > 2) overstrideQuality = "slight";
  }

  const headNodScore = Math.min(100, Math.round((rhythmRegularity ?? 70) * 0.9 + beatEvenness * 0.1));

  let qualityTier: SinglefootQualityMetrics["qualityTier"];
  const composite = beatEvenness * 0.4 + headNodScore * 0.3 + (lateralSync ? (100 - Math.abs(lateralSync - 50)) : 50) * 0.3;
  if (composite >= 85) qualityTier = "premium";
  else if (composite >= 70) qualityTier = "good";
  else if (composite >= 55) qualityTier = "developing";
  else qualityTier = "rough";

  const descriptions: Record<string, string> = {
    premium: "סינגלפוט איכותי מעולה — 4 פעימות שוות, ללא ריחוף, נוחות רכיבה מרבית",
    good: "סינגלפוט טוב — 4 פעימות ברורות עם חוסר אחידות קל",
    developing: "סינגלפוט מתפתח — ארבע פעימות מזוהות אך עם נטייה לקיפול לטרלי",
    rough: "סינגלפוט גס — קצב לא אחיד, ייתכן מעבר לפייס או טרוט",
  };

  return {
    beatEvenness,
    lateralDissociationMs,
    isTrueSinglefoot,
    overstrideQuality,
    headNodScore,
    qualityTier,
    description: descriptions[qualityTier],
  };
}

/** Gait metadata for gaited horse visualization */
export interface GaitMeta {
  beats: number;
  nameHe: string;
  nameEn: string;
  tendency: "lateral" | "diagonal" | "even";
  hasSuspension: boolean;
  stanceDuty: number;
  description: string;
  /** Lateral sequence footfall order for this gait */
  footfallOrder?: string[];
}

export const GAIT_META: Record<string, GaitMeta> = {
  walk:         { beats: 4, nameHe: "הליכה", nameEn: "Walk", tendency: "lateral", hasSuspension: false, stanceDuty: 0.65, description: "4 פעימות — תמיד לפחות 2 רגליים במגע, הצעד הבסיסי ביותר", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  trot:         { beats: 2, nameHe: "טרוט", nameEn: "Trot", tendency: "diagonal", hasSuspension: true, stanceDuty: 0.5, description: "צמד אלכסוני — עם ריחוף" },
  pace:         { beats: 2, nameHe: "פייס", nameEn: "Pace", tendency: "lateral", hasSuspension: true, stanceDuty: 0.5, description: "צמד לטרלי — עם ריחוף" },
  tolt:         { beats: 4, nameHe: "טולט", nameEn: "Tölt", tendency: "lateral", hasSuspension: false, stanceDuty: 0.65, description: "4 פעימות לטרלי — ללא ריחוף, רגל אחת תמיד על הקרקע", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  tölt:         { beats: 4, nameHe: "טולט", nameEn: "Tölt", tendency: "lateral", hasSuspension: false, stanceDuty: 0.65, description: "4 פעימות לטרלי — ללא ריחוף, רגל אחת תמיד על הקרקע", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  running_walk: { beats: 4, nameHe: "הליכה רצה", nameEn: "Running Walk", tendency: "lateral", hasSuspension: false, stanceDuty: 0.65, description: "4 פעימות — צעד מעבר ארוך, ראש מנהן", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  rack:         { beats: 4, nameHe: "ראק", nameEn: "Rack", tendency: "even", hasSuspension: false, stanceDuty: 0.55, description: "4 פעימות שוות — קצב מהיר, הרמת ברכיים גבוהה", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  fox_trot:     { beats: 4, nameHe: "פוקס טרוט", nameEn: "Fox Trot", tendency: "diagonal", hasSuspension: false, stanceDuty: 0.6, description: "הליכה קדמית + טרוט אחורי — החלקה בנחיתה" },
  foxtrot:      { beats: 4, nameHe: "פוקס טרוט", nameEn: "Fox Trot", tendency: "diagonal", hasSuspension: false, stanceDuty: 0.6, description: "הליכה קדמית + טרוט אחורי — החלקה בנחיתה" },
  singlefoot:   { beats: 4, nameHe: "סינגלפוט", nameEn: "Singlefoot", tendency: "lateral", hasSuspension: false, stanceDuty: 0.6, description: "4 פעימות שוות — כל רגל נוחתת בנפרד, נטייה לטרלית", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  broken_pace:  { beats: 4, nameHe: "פייס שבור", nameEn: "Broken Pace", tendency: "lateral", hasSuspension: false, stanceDuty: 0.55, description: "פייס עם פיצול — ביניים בין פייס לסינגלפוט", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  paso_fino:    { beats: 4, nameHe: "פאסו פינו", nameEn: "Paso Fino", tendency: "lateral", hasSuspension: false, stanceDuty: 0.7, description: "4 פעימות מהירות מאוד — צעד קצר, תנועת גוף מינימלית", footfallOrder: ["אח-ש", "קד-ש", "אח-י", "קד-י"] },
  paso_largo:   { beats: 4, nameHe: "פאסו לארגו", nameEn: "Paso Largo", tendency: "lateral", hasSuspension: false, stanceDuty: 0.6, description: "4 פעימות מורחבות — צעד ארוך" },
  paso_corto:   { beats: 4, nameHe: "פאסו קורטו", nameEn: "Paso Corto", tendency: "lateral", hasSuspension: false, stanceDuty: 0.65, description: "4 פעימות בינוניות — נוחות רכיבה גבוהה" },
};

/** Get phase offsets for a given gait type */
export function getPhaseOffsetsForGait(gaitType?: string): Record<string, number> {
  if (!gaitType) return GAIT_PHASE_PROFILES.default;
  const key = gaitType.toLowerCase().replace(/[\s-]/g, "_");
  return GAIT_PHASE_PROFILES[key] ?? GAIT_PHASE_PROFILES.default;
}

/** Get gait metadata for a given gait type */
export function getGaitMeta(gaitType?: string): GaitMeta | null {
  if (!gaitType) return null;
  const key = gaitType.toLowerCase().replace(/[\s-]/g, "_");
  return GAIT_META[key] ?? null;
}

/** Get leg pairing connections for SVG visualization */
export function getGaitPairings(gaitType?: string): { legs: [string, string]; label: string }[] {
  const meta = getGaitMeta(gaitType);
  if (!meta) return [];
  if (meta.tendency === "diagonal") {
    return [
      { legs: ["frontLeft", "hindRight"], label: "אלכסוני" },
      { legs: ["frontRight", "hindLeft"], label: "אלכסוני" },
    ];
  }
  if (meta.tendency === "lateral") {
    return [
      { legs: ["frontLeft", "hindLeft"], label: "לטרלי" },
      { legs: ["frontRight", "hindRight"], label: "לטרלי" },
    ];
  }
  return []; // even = no strong pairing
}

/**
 * Get the footfall beat order for four-beat gaits.
 * Returns the order in which hooves strike the ground in one cycle.
 * Based on lateral sequence: LH → LF → RH → RF (Nicodemus & Clayton 2003)
 */
export function getFourBeatOrder(gaitType?: string): { legKey: string; label: string; color: string; phaseOffset: number }[] {
  const offsets = getPhaseOffsetsForGait(gaitType);
  const meta = getGaitMeta(gaitType);
  if (!meta || meta.beats !== 4) return [];

  // Sort legs by their phase offset to get footfall order
  const legs = Object.entries(offsets)
    .map(([key, offset]) => ({
      legKey: key,
      label: LEG_LABELS_SHORT[key] || key,
      color: LEG_COLORS[key] || "#888",
      phaseOffset: offset,
    }))
    .sort((a, b) => a.phaseOffset - b.phaseOffset);

  return legs;
}

export const LEG_JOINT_MAP: Record<string, string[]> = {
  frontLeft: ["shoulder", "carpus", "fetlock"],
  frontRight: ["shoulder", "carpus", "fetlock"],
  hindLeft: ["hip", "stifle", "fetlock"],
  hindRight: ["hip", "stifle", "fetlock"],
};

export const LEG_CONNECTIONS: Record<string, string[]> = {
  frontLeft: ["shoulder", "carpus", "fetlock", "hoof"],
  frontRight: ["shoulder", "carpus", "fetlock", "hoof"],
  hindLeft: ["hip", "stifle", "fetlock", "hoof"],
  hindRight: ["hip", "stifle", "fetlock", "hoof"],
};

export const SUSPENSION_LABELS: Record<string, string> = {
  FL: "קדמית שמאל",
  FR: "קדמית ימין",
  HL: "אחורית שמאל",
  HR: "אחורית ימין",
};

export const PHASE_LABELS = ["דריכה", "הרמה", "תנופה", "נחיתה"];

// Heatmap: compute deviation from ideal range → 0 (perfect) to 1 (critical)
export function jointDeviation(value: number, range: [number, number]): number {
  const mid = (range[0] + range[1]) / 2;
  const halfSpan = (range[1] - range[0]) / 2;
  const dist = Math.abs(value - mid);
  return Math.min(1, Math.max(0, (dist - halfSpan) / 15));
}

// Interpolate green → yellow → red
export function heatColor(deviation: number): string {
  if (deviation <= 0) return "#22c55e";
  if (deviation <= 0.5) {
    const t = deviation * 2;
    const r = Math.round(34 + (234 - 34) * t);
    const g = Math.round(197 + (179 - 197) * t);
    const b = Math.round(94 + (8 - 94) * t);
    return `rgb(${r},${g},${b})`;
  }
  const t = (deviation - 0.5) * 2;
  const r = Math.round(234 + (239 - 234) * t);
  const g = Math.round(179 + (68 - 179) * t);
  const b = Math.round(8 + (68 - 8) * t);
  return `rgb(${r},${g},${b})`;
}

export function heatColorRGB(deviation: number): [number, number, number] {
  if (deviation <= 0) return [0.13, 0.77, 0.37];
  if (deviation <= 0.5) {
    const t = deviation * 2;
    return [0.13 + (0.92 - 0.13) * t, 0.77 + (0.7 - 0.77) * t, 0.37 + (0.03 - 0.37) * t];
  }
  const t = (deviation - 0.5) * 2;
  return [0.92 + (0.94 - 0.92) * t, 0.7 + (0.27 - 0.7) * t, 0.03 + (0.27 - 0.03) * t];
}

export function getJointHeatColors(jointAngles?: Record<string, Record<string, number>>): Record<string, Record<string, { color: string; deviation: number; value: number }>> {
  const result: Record<string, Record<string, { color: string; deviation: number; value: number }>> = {};
  if (!jointAngles) return result;
  for (const [leg, joints] of Object.entries(jointAngles)) {
    result[leg] = {};
    for (const [joint, value] of Object.entries(joints)) {
      const range = NORMAL_RANGES[joint];
      if (range) {
        const dev = jointDeviation(value, range);
        result[leg][joint] = { color: heatColor(dev), deviation: dev, value };
      }
    }
  }
  return result;
}

export function findJointIssues(jointAngles?: Record<string, Record<string, number>>): JointIssue[] {
  if (!jointAngles) return [];
  const issues: JointIssue[] = [];
  for (const [leg, joints] of Object.entries(jointAngles)) {
    if (!joints || typeof joints !== "object") continue;
    for (const [joint, value] of Object.entries(joints)) {
      const range = NORMAL_RANGES[joint];
      if (range && (value < range[0] - 5 || value > range[1] + 5)) {
        issues.push({ leg, joint, value, normal: range });
      }
    }
  }
  return issues;
}

export function drawLegPoints(kp: Keypoint): [number, number][] {
  const points: [number, number][] = [];
  if (kp.shoulder || kp.hip) points.push((kp.shoulder || kp.hip) as [number, number]);
  if (kp.carpus || kp.stifle) points.push((kp.carpus || kp.stifle) as [number, number]);
  if (kp.fetlock) points.push(kp.fetlock);
  if (kp.hoof) points.push(kp.hoof);
  return points;
}

export function normalizeKeypoints(keypoints: KeypointsData, w: number, h: number): KeypointsData {
  const allPoints: [number, number][] = [];
  const legs = [keypoints.frontLeft, keypoints.frontRight, keypoints.hindLeft, keypoints.hindRight];
  for (const leg of legs) {
    if (!leg) continue;
    for (const val of Object.values(leg)) {
      if (Array.isArray(val) && val.length === 2 && typeof val[0] === "number") {
        allPoints.push(val as [number, number]);
      }
    }
  }
  if (allPoints.length < 2) return keypoints;

  const xs = allPoints.map(p => p[0]);
  const ys = allPoints.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const padding = 0.12;
  const scaleX = w * (1 - 2 * padding) / rangeX;
  const scaleY = h * (1 - 2 * padding) / rangeY;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (w - rangeX * scale) / 2;
  const offsetY = (h - rangeY * scale) / 2;

  const mapPt = (pt: [number, number]): [number, number] => [
    (pt[0] - minX) * scale + offsetX,
    (pt[1] - minY) * scale + offsetY,
  ];

  const mapLeg = (leg?: Keypoint): Keypoint | undefined => {
    if (!leg) return undefined;
    const mapped: Keypoint = {};
    if (leg.hoof) mapped.hoof = mapPt(leg.hoof);
    if (leg.fetlock) mapped.fetlock = mapPt(leg.fetlock);
    if (leg.carpus) mapped.carpus = mapPt(leg.carpus);
    if (leg.shoulder) mapped.shoulder = mapPt(leg.shoulder);
    if (leg.stifle) mapped.stifle = mapPt(leg.stifle);
    if (leg.hip) mapped.hip = mapPt(leg.hip);
    return mapped;
  };

  return {
    detected: true,
    frontLeft: mapLeg(keypoints.frontLeft),
    frontRight: mapLeg(keypoints.frontRight),
    hindLeft: mapLeg(keypoints.hindLeft),
    hindRight: mapLeg(keypoints.hindRight),
  };
}

/**
 * Research-based limb trajectory for gaited horses.
 * 
 * Real horse hoof trajectory follows an asymmetric "D-shaped" arc:
 * - Stance: hoof on ground, slides backward (retraction)
 * - Breakover: rapid heel-first lift-off
 * - Swing: fast forward arc with peak height at ~60% of swing
 * - Landing: deceleration, toe-first or flat landing
 *
 * Joint cascading: distal joints lag behind proximal —
 * shoulder/hip move first, then knee/stifle, then fetlock, then hoof.
 *
 * References:
 * - Clayton (2004): The Dynamic Horse — limb kinematics
 * - Hobbs et al. (2016): Hoof trajectory in gaited breeds
 * - Vincelette (2023): Four-beat lateral gait analysis
 */

/** Smooth step for natural transitions */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Quintic ease for very smooth acceleration/deceleration */
function quinticEase(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function compute3DDisplacement(
  phase: number,
  gaitType?: string,
  legName?: string,
): { liftY: number; swingZ: number; overstrideZ: number; lateralX: number; jointLag: number } {
  const meta = getGaitMeta(gaitType);
  const isFourBeat = meta?.beats === 4;
  const stanceDuty = meta?.stanceDuty ?? 0.5;
  const normalizedPhase = ((phase % 1) + 1) % 1;
  const gaitKey = gaitType?.toLowerCase().replace(/[\s-]/g, "_") ?? "";
  const isHind = legName?.startsWith("hind") ?? false;
  const isLeft = legName?.includes("Left") ?? false;

  let liftY = 0;
  let swingZ = 0;
  let overstrideZ = 0;
  let lateralX = 0;
  let jointLag = 0; // 0..1 how much distal joints should lag

  if (isFourBeat) {
    if (normalizedPhase < stanceDuty) {
      // ─── STANCE PHASE ───
      // Hoof on ground, retracting backward smoothly
      const t = normalizedPhase / stanceDuty;
      // Slight fetlock sink at mid-stance (weight bearing)
      liftY = -Math.sin(t * Math.PI) * 0.012;
      // Retraction: hoof slides backward relative to body
      swingZ = (0.5 - t) * 0.05;
      // Joint lag is minimal during stance
      jointLag = 0.1;
      // Subtle lateral shift during stance (weight transfer)
      lateralX = Math.sin(t * Math.PI) * 0.003 * (isLeft ? -1 : 1);
    } else {
      // ─── SWING PHASE ───
      const swingDuration = 1 - stanceDuty;
      const t = (normalizedPhase - stanceDuty) / swingDuration;

      // Asymmetric D-shaped arc: fast lift, peak at 55%, smooth landing
      // Breakover (0-15%): rapid lift
      // Mid-swing (15-60%): peak height, forward reach
      // Landing (60-100%): deceleration, set-down
      const liftCurve = t < 0.15
        ? quinticEase(t / 0.15) // rapid breakover
        : t < 0.6
          ? 1.0 - 0.15 * smoothstep((t - 0.15) / 0.45) // sustained height
          : Math.cos(((t - 0.6) / 0.4) * Math.PI * 0.5); // smooth landing

      // Gait-specific amplitude
      let amplitude: number;
      if (gaitKey === "rack") amplitude = 0.14; // high knee action
      else if (gaitKey === "paso_fino") amplitude = 0.06; // tiny, rapid steps
      else if (gaitKey === "running_walk") amplitude = 0.09;
      else if (gaitKey === "tolt" || gaitKey === "tölt") amplitude = 0.10;
      else amplitude = 0.09; // singlefoot default

      // Hind legs lift slightly lower than front
      if (isHind) amplitude *= 0.85;

      liftY = liftCurve * amplitude;

      // Forward protraction: S-curve (fast forward, decelerate near landing)
      swingZ = quinticEase(t) * 0.08 - 0.03;

      // Joint lag peaks during mid-swing (distal segments trail)
      jointLag = Math.sin(t * Math.PI) * 0.7;

      // Lateral: slight abduction during swing
      lateralX = Math.sin(t * Math.PI) * 0.006 * (isLeft ? 1 : -1);
    }

    // Running walk: hind overstride
    if (gaitKey === "running_walk" && isHind) {
      overstrideZ = 0.03;
    }
  } else {
    // ─── 2-BEAT (TROT / PACE) ───
    const isSwing = normalizedPhase >= stanceDuty;
    if (isSwing) {
      const t = (normalizedPhase - stanceDuty) / (1 - stanceDuty);
      // Higher arc for trot (suspension phase)
      const amp = gaitKey === "pace" ? 0.10 : 0.12;
      liftY = Math.sin(t * Math.PI) * amp;
      swingZ = quinticEase(t) * 0.07 - 0.03;
      jointLag = Math.sin(t * Math.PI) * 0.6;
      lateralX = Math.sin(t * Math.PI) * 0.004 * (isLeft ? 1 : -1);
    } else {
      const t = normalizedPhase / stanceDuty;
      liftY = -Math.sin(t * Math.PI) * 0.015;
      swingZ = (0.5 - t) * 0.06;
      jointLag = 0.1;
      lateralX = Math.sin(t * Math.PI) * 0.003 * (isLeft ? -1 : 1);
    }
  }

  return { liftY, swingZ, overstrideZ, lateralX, jointLag };
}

/**
 * 2-bone Inverse Kinematics solver for horse leg in the sagittal plane.
 *
 * Given a target hoof position relative to the hip pivot, computes the
 * hip, knee, and fetlock joint angles that place the hoof at that target.
 * The fetlock angle keeps the hoof flat on the ground.
 *
 * This eliminates "foot sliding" — the main visual artefact of analytical
 * rotation-only leg animation.
 *
 * @param upperLen  Upper leg segment length (shoulder→knee / hip→stifle)
 * @param lowerLen  Lower leg segment length (knee→fetlock / stifle→fetlock)
 * @param hoofLen   Hoof segment length (fetlock→ground)
 * @param targetFwd Forward distance from hip pivot (positive = forward)
 * @param targetDwn Downward distance from hip pivot to ground (positive = down)
 */
export function solveLegIK(
  upperLen: number,
  lowerLen: number,
  hoofLen: number,
  targetFwd: number,
  targetDwn: number,
): { hipAngle: number; kneeAngle: number; fetlockAngle: number } {
  // Solve for fetlock position (hoof segment hangs below fetlock)
  const fetDwn = Math.max(0.02, targetDwn - hoofLen);
  const d = Math.sqrt(targetFwd * targetFwd + fetDwn * fetDwn);

  const a = upperLen;
  const b = lowerLen;

  // Clamp to reachable range to avoid NaN from acos
  const maxReach = a + b - 0.002;
  const minReach = Math.abs(a - b) + 0.002;
  const dc = Math.max(minReach, Math.min(maxReach, d));

  // Angle from downward-vertical to the target direction
  const theta = Math.atan2(targetFwd, fetDwn);

  // Law of cosines: sub-angle at hip between upper leg and line-to-target
  const cosAlpha = (a * a + dc * dc - b * b) / (2 * a * dc);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
  const hipAngle = theta - alpha;

  // Law of cosines: internal knee angle
  const cosK = (a * a + b * b - dc * dc) / (2 * a * b);
  const kInternal = Math.acos(Math.max(-1, Math.min(1, cosK)));
  // Knee bend: 0 when straight (kInternal=PI), negative when flexed
  const kneeAngle = -(Math.PI - kInternal);

  // Fetlock: compensate cumulative rotation to keep hoof vertical (flat on ground)
  const fetlockAngle = -(hipAngle + kneeAngle);

  return { hipAngle, kneeAngle, fetlockAngle };
}

/**
 * Compute body COM vertical oscillation based on gait phase.
 * In trot: 2 oscillations per stride (body rises during suspension).
 * In four-beat: 4 smaller oscillations (no suspension, smoother ride).
 */
export function computeBodyCOM(
  phase: number,
  gaitType?: string,
): { verticalShift: number; lateralShift: number; pitchRad: number; rollRad: number; forwardShift: number } {
  const meta = getGaitMeta(gaitType);
  const p = ((phase % 1) + 1) % 1;
  const gaitKey = gaitType?.toLowerCase().replace(/[\s-]/g, "_") ?? "";

  if (meta?.beats === 4) {
    // Four-beat gaits: body oscillation follows weight transfer pattern
    // The body dips slightly each time a leg takes weight (4× per cycle)
    // and sways laterally as weight shifts left↔right (2× per cycle)
    const isRack = gaitKey === "rack" || gaitKey === "singlefoot" || gaitKey === "four_beat";
    const isTolt = gaitKey === "tolt" || gaitKey === "tölt";
    const isRunningWalk = gaitKey === "running_walk";
    const isPasoFino = gaitKey === "paso_fino";

    // Vertical: 4 dips per cycle — each footfall causes a small COM drop
    // Use sum of harmonics for natural feel (fundamental + 2nd harmonic)
    const vertAmp = isPasoFino ? 0.004 : isRack ? 0.012 : isTolt ? 0.011 : isRunningWalk ? 0.014 : 0.010;
    const vertMain = Math.sin(p * Math.PI * 4) * vertAmp;
    const vertHarmonic = Math.sin(p * Math.PI * 8 + 0.5) * vertAmp * 0.15; // subtle 2nd harmonic
    const verticalShift = vertMain + vertHarmonic;

    // Lateral sway: 2× per cycle (left-right weight transfer)
    const latAmp = isPasoFino ? 0.003 : isRack ? 0.010 : 0.008;
    const lateralShift = Math.sin(p * Math.PI * 2) * latAmp;

    // Pitch (head bob): 4× per cycle, phase-shifted to match footfalls
    // Running walk has pronounced head nod (important breed characteristic)
    const pitchAmp = isPasoFino ? 0.008 : isRunningWalk ? 0.025 : isRack ? 0.018 : 0.014;
    const headBobPhase = isRunningWalk ? 0.8 : 0.4;
    const pitchRad = Math.sin(p * Math.PI * 4 + headBobPhase) * pitchAmp;

    // Roll: 2× per cycle, follows lateral sway with phase offset
    const rollAmp = isPasoFino ? 0.006 : isRack ? 0.018 : 0.014;
    const rollRad = Math.sin(p * Math.PI * 2 + 0.3) * rollAmp;

    // Forward surge: 4× per cycle (body accelerates/decelerates with each push-off)
    const fwdAmp = isRunningWalk ? 0.008 : isRack ? 0.006 : 0.004;
    const forwardShift = Math.sin(p * Math.PI * 4 + 0.6) * fwdAmp;

    return { verticalShift, lateralShift, pitchRad, rollRad, forwardShift };
  }

  // 2-beat gaits: trot has suspension phase (body rises), pace has lateral sway
  const isTrot = gaitKey === "trot" || gaitKey === "diagonal";
  // Trot: body rises during diagonal suspension, drops on landing
  // Pace: body sways laterally with same-side pairs
  const vertAmp2 = isTrot ? 0.014 : 0.008;
  const latAmp2 = isTrot ? 0.003 : 0.010;
  return {
    verticalShift: Math.sin(p * Math.PI * 2) * vertAmp2,
    lateralShift: Math.sin(p * Math.PI * 2) * latAmp2,
    pitchRad: Math.sin(p * Math.PI * 2 + 0.2) * (isTrot ? 0.012 : 0.010),
    rollRad: Math.sin(p * Math.PI * 2 + 0.3) * (isTrot ? 0.004 : 0.012),
    forwardShift: Math.sin(p * Math.PI * 2 + 0.4) * (isTrot ? 0.005 : 0.004),
  };
}

/**
 * Get stance duty for GRF calculation — gait-aware.
 */
export function getStanceDuty(gaitType?: string): number {
  const meta = getGaitMeta(gaitType);
  return meta?.stanceDuty ?? 0.5;
}

/**
 * Compute head bob amplitude for gaited horses.
 * Running walk has prominent head nod; singlefoot is minimal.
 */
export function getHeadBobAmplitude(gaitType?: string): number {
  const key = gaitType?.toLowerCase().replace(/[\s-]/g, "_") ?? "";
  if (key === "walk") return 0.03;
  if (key === "running_walk") return 0.04;
  if (key === "rack") return 0.015;
  if (key === "singlefoot" || key === "four_beat" || key === "tolt" || key === "tölt") return 0.01;
  if (key === "trot") return 0.025;
  if (key === "pace") return 0.02;
  return 0.015;
}

export function displaceLeg(
  kp: Keypoint | undefined,
  phase: number,
  amplitude: number,
  gaitType?: string
): Keypoint | undefined {
  if (!kp) return undefined;

  const meta = getGaitMeta(gaitType);
  const isFourBeat = meta?.beats === 4;
  const stanceDuty = meta?.stanceDuty ?? 0.5;

  // Normalize phase to 0-1
  const normalizedPhase = ((phase % 1) + 1) % 1;

  let liftY: number;
  let swingX: number;

  if (isFourBeat) {
    if (normalizedPhase < stanceDuty) {
      const stanceProgress = normalizedPhase / stanceDuty;
      liftY = -Math.sin(stanceProgress * Math.PI) * amplitude * 0.08;
      swingX = (stanceProgress - 0.5) * amplitude * 0.5;
    } else {
      const swingProgress = (normalizedPhase - stanceDuty) / (1 - stanceDuty);
      liftY = -Math.sin(swingProgress * Math.PI) * amplitude * 0.85;
      swingX = (swingProgress - 0.5) * amplitude * 0.8;
    }
  } else {
    liftY = -Math.abs(Math.sin(normalizedPhase * Math.PI * 2)) * amplitude;
    swingX = Math.cos(normalizedPhase * Math.PI * 2) * amplitude * 0.4;
  }

  const displace = (pt: [number, number] | undefined, factor: number): [number, number] | undefined => {
    if (!pt) return undefined;
    return [pt[0] + swingX * factor, pt[1] + liftY * factor];
  };

  return {
    shoulder: displace(kp.shoulder, 0.15),
    hip: displace(kp.hip, 0.15),
    carpus: displace(kp.carpus, 0.45),
    stifle: displace(kp.stifle, 0.45),
    fetlock: displace(kp.fetlock, 0.80),
    hoof: displace(kp.hoof, 1.0),
  };
}
