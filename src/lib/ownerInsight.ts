export interface InsightInput {
  gaitType: string;
  symmetry: number;
  lateralSync: number;
  confidence: number;
}

export interface PreviousAnalysis {
  symmetry: number | null;
  lateralSync: number | null;
  createdAt: string;
}

export type Trend = "up" | "down" | "flat";

/** Change below this many points is treated as noise, not progress. */
export const TREND_THRESHOLD = 3;

export function trendOf(current: number, previous: number | null | undefined): Trend | null {
  if (previous === null || previous === undefined || !Number.isFinite(previous)) return null;
  const delta = current - previous;
  if (Math.abs(delta) < TREND_THRESHOLD) return "flat";
  return delta > 0 ? "up" : "down";
}

export function buildSummary(r: InsightInput, lang: "he" | "en"): string {
  const sym = Math.round(r.symmetry);
  const low = r.confidence < 60;
  const symWord =
    sym >= 85 ? (lang === "he" ? "סימטריה טובה" : "good symmetry")
    : sym >= 70 ? (lang === "he" ? "סימטריה סבירה" : "fair symmetry")
    : (lang === "he" ? "סימטריה שדורשת תשומת לב" : "symmetry that needs attention");
  if (lang === "he") {
    return `זוהה צעד ${r.gaitType} עם ${symWord} (SI ${sym}).${low ? " הוודאות נמוכה — מומלץ לצלם שוב מהצד." : ""}`;
  }
  return `Detected ${r.gaitType} with ${symWord} (SI ${sym}).${low ? " Confidence is low — consider re-filming from the side." : ""}`;
}
