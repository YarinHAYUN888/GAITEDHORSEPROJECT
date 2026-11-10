// FEIF judging standards for Icelandic horse gaits — T1 (Tölt), T2 (Slow Tölt), V1 (Pace)
// Based on FEIF Rules 2025, judge guidelines 2024

export interface FEIFCriterion {
  id: string;
  nameEn: string;
  nameHe: string;
  weight: number;       // fraction of total score
  description: string;  // Hebrew description
  thresholds: {
    excellent: [number, number]; // 9-10
    good: [number, number];     // 7-8.9
    fair: [number, number];     // 5-6.9
    poor: [number, number];     // below 5
  };
}

export interface FEIFTest {
  id: string;
  nameEn: string;
  nameHe: string;
  description: string;
  criteria: FEIFCriterion[];
}

export const FEIF_TESTS: FEIFTest[] = [
  {
    id: "T1",
    nameEn: "T1 — Tölt",
    nameHe: "T1 — טולט",
    description: "הערכת טולט בקצב חופשי. דגש על ארבע פעימות ברורות, קצב עקבי, ונשיאה טובה.",
    criteria: [
      {
        id: "beat_clarity",
        nameEn: "Beat Clarity",
        nameHe: "בהירות פעימות",
        weight: 0.30,
        description: "4 פעימות שוות וברורות, ללא דלדול או חפיפה. ציון מבוסס על rhythmRegularity.",
        thresholds: { excellent: [93, 100], good: [82, 93], fair: [70, 82], poor: [0, 70] },
      },
      {
        id: "tempo_consistency",
        nameEn: "Tempo Consistency",
        nameHe: "עקביות קצב",
        weight: 0.20,
        description: "הקצב (BPM) נשמר אחיד לאורך כל ההופעה, ללא האצות או האטות חדות.",
        thresholds: { excellent: [90, 100], good: [78, 90], fair: [65, 78], poor: [0, 65] },
      },
      {
        id: "suppleness",
        nameEn: "Suppleness & Carriage",
        nameHe: "גמישות ונשיאה",
        weight: 0.20,
        description: "הסוס נושא את עצמו בגמישות, ראש גבוה בטבעיות, גב גמיש.",
        thresholds: { excellent: [88, 100], good: [75, 88], fair: [60, 75], poor: [0, 60] },
      },
      {
        id: "speed_range",
        nameEn: "Speed Range (Slow/Fast Tölt)",
        nameHe: "טווח מהירויות",
        weight: 0.15,
        description: "יכולת ביצוע טולט איטי ומהיר תוך שמירה על איכות.",
        thresholds: { excellent: [85, 100], good: [72, 85], fair: [58, 72], poor: [0, 58] },
      },
      {
        id: "symmetry",
        nameEn: "Symmetry",
        nameHe: "סימטריה",
        weight: 0.15,
        description: "תנועה סימטרית בין ימין לשמאל, ללא העדפת צד.",
        thresholds: { excellent: [92, 100], good: [83, 92], fair: [70, 83], poor: [0, 70] },
      },
    ],
  },
  {
    id: "T2",
    nameEn: "T2 — Slow Tölt",
    nameHe: "T2 — טולט איטי",
    description: "הערכת טולט בקצב איטי. דגש מוגבר על בהירות פעימות ונשיאה עצמית.",
    criteria: [
      {
        id: "beat_clarity",
        nameEn: "Beat Clarity",
        nameHe: "בהירות פעימות",
        weight: 0.35,
        description: "4 פעימות ברורות בקצב איטי — קשה יותר לשמור. ציון גבוה יותר.",
        thresholds: { excellent: [95, 100], good: [85, 95], fair: [72, 85], poor: [0, 72] },
      },
      {
        id: "collection",
        nameEn: "Collection & Balance",
        nameHe: "איסוף ואיזון",
        weight: 0.30,
        description: "הסוס באיסוף גבוה, משקל על הרגליים האחוריות, פלג עליון מורם.",
        thresholds: { excellent: [90, 100], good: [78, 90], fair: [65, 78], poor: [0, 65] },
      },
      {
        id: "tempo_consistency",
        nameEn: "Tempo Consistency",
        nameHe: "עקביות קצב",
        weight: 0.20,
        description: "שמירה על קצב איטי אחיד ללא שינויים.",
        thresholds: { excellent: [92, 100], good: [80, 92], fair: [68, 80], poor: [0, 68] },
      },
      {
        id: "symmetry",
        nameEn: "Symmetry",
        nameHe: "סימטריה",
        weight: 0.15,
        description: "סימטריה מושלמת בין ימין לשמאל.",
        thresholds: { excellent: [93, 100], good: [84, 93], fair: [72, 84], poor: [0, 72] },
      },
    ],
  },
  {
    id: "F1",
    nameEn: "F1 — Five-Gait (Pace section)",
    nameHe: "F1 — פייס (אנדדורה)",
    description: "הערכת פייס/אנדדורה. דגש על 2 פעימות לטרליות ברורות, זמן אוויר ומהירות.",
    criteria: [
      {
        id: "lateral_sync",
        nameEn: "Lateral Synchronization",
        nameHe: "סינכרון לטרלי",
        weight: 0.30,
        description: "שתי רגליים באותו צד נעות ביחד. סטייה מעל 5% = פייס מלוכלך.",
        thresholds: { excellent: [96, 100], good: [90, 96], fair: [82, 90], poor: [0, 82] },
      },
      {
        id: "suspension",
        nameEn: "Suspension / Air Time",
        nameHe: "זמן אוויר",
        weight: 0.25,
        description: "רגע מרחף ברור בין הצעדים. suspension ratio אידיאלי: 0.40-0.55.",
        thresholds: { excellent: [88, 100], good: [75, 88], fair: [60, 75], poor: [0, 60] },
      },
      {
        id: "speed_acceleration",
        nameEn: "Speed & Acceleration",
        nameHe: "מהירות והאצה",
        weight: 0.20,
        description: "פייס במהירות גבוהה עם האצה חלקה.",
        thresholds: { excellent: [85, 100], good: [72, 85], fair: [58, 72], poor: [0, 58] },
      },
      {
        id: "beat_purity",
        nameEn: "Beat Purity (2-beat)",
        nameHe: "נקיון פעימה (2-beat)",
        weight: 0.15,
        description: "2 פעימות ברורות ונקיות. זיהוי 3+ פעימות = פייס מעורב.",
        thresholds: { excellent: [94, 100], good: [85, 94], fair: [72, 85], poor: [0, 72] },
      },
      {
        id: "symmetry",
        nameEn: "Symmetry",
        nameHe: "סימטריה",
        weight: 0.10,
        description: "תנועה סימטרית.",
        thresholds: { excellent: [93, 100], good: [85, 93], fair: [74, 85], poor: [0, 74] },
      },
    ],
  },
];

export interface FEIFScoreResult {
  testId: string;
  testNameHe: string;
  totalScore: number; // 0-10 scale
  criterionScores: {
    criterionId: string;
    nameHe: string;
    rawValue: number;
    score: number; // 0-10
    grade: "excellent" | "good" | "fair" | "poor";
    weight: number;
  }[];
  warnings: string[];
}

export function mapToFEIFScores(
  testId: string,
  metrics: {
    rhythmRegularity?: number;
    symmetryScore?: number;
    lateralSync?: number;
    bpm?: number;
    extensionQuality?: number; // 0-100
    suspensionRatio?: number;
    overallScore?: number;
  }
): FEIFScoreResult | null {
  const test = FEIF_TESTS.find(t => t.id === testId);
  if (!test) return null;

  const warnings: string[] = [];
  const criterionScores: FEIFScoreResult["criterionScores"] = [];

  for (const criterion of test.criteria) {
    let rawValue = 0;

    // Map criterion to available metrics
    switch (criterion.id) {
      case "beat_clarity":
        rawValue = metrics.rhythmRegularity ?? 75;
        break;
      case "tempo_consistency":
        rawValue = metrics.rhythmRegularity ? Math.min(100, metrics.rhythmRegularity + 5) : 70;
        break;
      case "suppleness":
      case "collection":
        rawValue = metrics.extensionQuality ?? metrics.overallScore ?? 70;
        break;
      case "speed_range":
      case "speed_acceleration":
        rawValue = metrics.overallScore ?? 70;
        break;
      case "symmetry":
        rawValue = metrics.symmetryScore ?? 80;
        break;
      case "lateral_sync":
        rawValue = metrics.lateralSync ?? 85;
        break;
      case "suspension":
        if (metrics.suspensionRatio !== undefined) {
          // Map 0.40-0.55 ideal range to 90-100, outside to lower
          const ideal = 0.475;
          const deviation = Math.abs(metrics.suspensionRatio - ideal);
          rawValue = Math.max(40, Math.round(100 - deviation * 300));
        } else {
          rawValue = 70;
        }
        break;
      case "beat_purity":
        rawValue = metrics.lateralSync ?? metrics.rhythmRegularity ?? 80;
        break;
      default:
        rawValue = 70;
    }

    // Determine grade
    let grade: "excellent" | "good" | "fair" | "poor";
    let score: number;

    if (rawValue >= criterion.thresholds.excellent[0]) {
      grade = "excellent";
      score = 9 + ((rawValue - criterion.thresholds.excellent[0]) / (criterion.thresholds.excellent[1] - criterion.thresholds.excellent[0]));
    } else if (rawValue >= criterion.thresholds.good[0]) {
      grade = "good";
      score = 7 + 2 * ((rawValue - criterion.thresholds.good[0]) / (criterion.thresholds.good[1] - criterion.thresholds.good[0]));
    } else if (rawValue >= criterion.thresholds.fair[0]) {
      grade = "fair";
      score = 5 + 2 * ((rawValue - criterion.thresholds.fair[0]) / (criterion.thresholds.fair[1] - criterion.thresholds.fair[0]));
    } else {
      grade = "poor";
      score = Math.max(1, 5 * (rawValue / (criterion.thresholds.fair[0] || 70)));
    }

    score = Math.round(Math.min(10, Math.max(0, score)) * 10) / 10;

    if (grade === "poor") {
      warnings.push(`${criterion.nameHe}: ציון נמוך (${score}/10) — דורש שיפור`);
    }

    criterionScores.push({ criterionId: criterion.id, nameHe: criterion.nameHe, rawValue, score, grade, weight: criterion.weight });
  }

  const totalScore = Math.round(criterionScores.reduce((sum, c) => sum + c.score * c.weight, 0) * 10) / 10;

  return { testId, testNameHe: test.nameHe, totalScore, criterionScores, warnings };
}

// Determine which FEIF test is most relevant for a given gait type
export function getRelevantFEIFTests(gaitType: string): string[] {
  const lower = gaitType.toLowerCase();
  if (lower.includes("tölt") || lower === "tolt") return ["T1", "T2"];
  if (lower.includes("pace") || lower.includes("andadura") || lower === "אנדדורה") return ["F1"];
  // For other gaits, T1 can serve as general quality baseline
  if (lower.includes("running_walk") || lower.includes("fox_trot")) return ["T1"];
  return [];
}
