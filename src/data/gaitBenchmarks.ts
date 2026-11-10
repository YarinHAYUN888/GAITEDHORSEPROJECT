// Gait quality benchmarks based on ISHA/SOBA standards and breed norms
export interface GaitBenchmark {
  metric: string;
  metricHe: string;
  top5: [number, number];     // min-max for top 5%
  top25: [number, number];
  average: [number, number];
  belowAvg: [number, number];
}

export interface BreedBenchmarks {
  breedId: string;
  breedNameHe: string;
  gaitType: string;
  gaitTypeHe: string;
  benchmarks: GaitBenchmark[];
}

export const GAIT_BENCHMARKS: BreedBenchmarks[] = [
  {
    breedId: "icelandic",
    breedNameHe: "איסלנדי",
    gaitType: "tölt",
    gaitTypeHe: "טולט",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [97, 100], top25: [93, 97], average: [85, 93], belowAvg: [0, 85] },
      { metric: "bpm", metricHe: "BPM", top5: [80, 95], top25: [70, 100], average: [65, 105], belowAvg: [0, 65] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [95, 100], top25: [90, 95], average: [80, 90], belowAvg: [0, 80] },
      { metric: "rhythmRegularity", metricHe: "סדירות מקצב", top5: [95, 100], top25: [90, 95], average: [80, 90], belowAvg: [0, 80] },
    ],
  },
  {
    breedId: "icelandic",
    breedNameHe: "איסלנדי",
    gaitType: "pace",
    gaitTypeHe: "אנדדורה / פייס",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [98, 100], top25: [95, 98], average: [88, 95], belowAvg: [0, 88] },
      { metric: "bpm", metricHe: "BPM", top5: [85, 110], top25: [80, 115], average: [75, 120], belowAvg: [0, 75] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [96, 100], top25: [92, 96], average: [85, 92], belowAvg: [0, 85] },
      { metric: "suspensionRatio", metricHe: "יחס זמן אוויר", top5: [0.42, 0.55], top25: [0.38, 0.55], average: [0.30, 0.55], belowAvg: [0, 0.30] },
    ],
  },
  {
    breedId: "paso-fino",
    breedNameHe: "פאסו פינו",
    gaitType: "paso_fino",
    gaitTypeHe: "פאסו פינו",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [97, 100], top25: [93, 97], average: [85, 93], belowAvg: [0, 85] },
      { metric: "bpm", metricHe: "BPM", top5: [100, 120], top25: [90, 125], average: [80, 130], belowAvg: [0, 80] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [96, 100], top25: [92, 96], average: [85, 92], belowAvg: [0, 85] },
      { metric: "rhythmRegularity", metricHe: "סדירות מקצב", top5: [97, 100], top25: [93, 97], average: [85, 93], belowAvg: [0, 85] },
    ],
  },
  {
    breedId: "tennessee-walker",
    breedNameHe: "טנסי ווקר",
    gaitType: "running_walk",
    gaitTypeHe: "Running Walk",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [95, 100], top25: [90, 95], average: [82, 90], belowAvg: [0, 82] },
      { metric: "bpm", metricHe: "BPM", top5: [55, 70], top25: [50, 75], average: [45, 80], belowAvg: [0, 45] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [94, 100], top25: [90, 94], average: [82, 90], belowAvg: [0, 82] },
    ],
  },
  {
    breedId: "peruvian-paso",
    breedNameHe: "פרואני פאסו",
    gaitType: "paso_llano",
    gaitTypeHe: "פאסו ליאנו",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [96, 100], top25: [92, 96], average: [84, 92], belowAvg: [0, 84] },
      { metric: "bpm", metricHe: "BPM", top5: [65, 85], top25: [60, 90], average: [55, 95], belowAvg: [0, 55] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [95, 100], top25: [91, 95], average: [83, 91], belowAvg: [0, 83] },
    ],
  },
  // Generic trot benchmarks for any breed
  {
    breedId: "_trot",
    breedNameHe: "כללי",
    gaitType: "trot",
    gaitTypeHe: "טרוט",
    benchmarks: [
      { metric: "diagonalSync", metricHe: "סינכרון אלכסוני", top5: [97, 100], top25: [93, 97], average: [85, 93], belowAvg: [0, 85] },
      { metric: "bpm", metricHe: "BPM", top5: [72, 88], top25: [68, 92], average: [60, 100], belowAvg: [0, 60] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [95, 100], top25: [90, 95], average: [82, 90], belowAvg: [0, 82] },
    ],
  },
  // Standardbred Trotter
  {
    breedId: "standardbred-trotter",
    breedNameHe: "סטנדרדברד טרוטר",
    gaitType: "trot",
    gaitTypeHe: "טרוט",
    benchmarks: [
      { metric: "diagonalSync", metricHe: "סינכרון אלכסוני", top5: [98, 100], top25: [95, 98], average: [88, 95], belowAvg: [0, 88] },
      { metric: "bpm", metricHe: "BPM", top5: [75, 95], top25: [70, 100], average: [65, 110], belowAvg: [0, 65] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [96, 100], top25: [92, 96], average: [85, 92], belowAvg: [0, 85] },
    ],
  },
  // Standardbred Pacer
  {
    breedId: "standardbred-pacer",
    breedNameHe: "סטנדרדברד פייסר",
    gaitType: "pace",
    gaitTypeHe: "פייס",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [98, 100], top25: [95, 98], average: [90, 95], belowAvg: [0, 90] },
      { metric: "bpm", metricHe: "BPM", top5: [90, 115], top25: [85, 120], average: [75, 125], belowAvg: [0, 75] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [96, 100], top25: [92, 96], average: [85, 92], belowAvg: [0, 85] },
    ],
  },
  // Saddlebred Rack
  {
    breedId: "saddlebred",
    breedNameHe: "סדלברד",
    gaitType: "rack",
    gaitTypeHe: "ראק",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [96, 100], top25: [92, 96], average: [84, 92], belowAvg: [0, 84] },
      { metric: "bpm", metricHe: "BPM", top5: [95, 120], top25: [85, 125], average: [75, 130], belowAvg: [0, 75] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [95, 100], top25: [90, 95], average: [82, 90], belowAvg: [0, 82] },
      { metric: "rhythmRegularity", metricHe: "סדירות מקצב", top5: [96, 100], top25: [92, 96], average: [84, 92], belowAvg: [0, 84] },
    ],
  },
  // Rocky Mountain Single-foot
  {
    breedId: "rocky-mountain",
    breedNameHe: "רוקי מאונטן",
    gaitType: "single_foot",
    gaitTypeHe: "Single-foot",
    benchmarks: [
      { metric: "lateralSync", metricHe: "סינכרון לטרלי", top5: [95, 100], top25: [91, 95], average: [83, 91], belowAvg: [0, 83] },
      { metric: "bpm", metricHe: "BPM", top5: [60, 80], top25: [55, 85], average: [50, 90], belowAvg: [0, 50] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [95, 100], top25: [90, 95], average: [82, 90], belowAvg: [0, 82] },
      { metric: "rhythmRegularity", metricHe: "סדירות מקצב", top5: [95, 100], top25: [90, 95], average: [82, 90], belowAvg: [0, 82] },
    ],
  },
  // Andalusian
  {
    breedId: "andalusian",
    breedNameHe: "אנדלוסי",
    gaitType: "trot",
    gaitTypeHe: "טרוט",
    benchmarks: [
      { metric: "diagonalSync", metricHe: "סינכרון אלכסוני", top5: [96, 100], top25: [92, 96], average: [84, 92], belowAvg: [0, 84] },
      { metric: "bpm", metricHe: "BPM", top5: [68, 82], top25: [64, 88], average: [58, 95], belowAvg: [0, 58] },
      { metric: "symmetry", metricHe: "סימטריה", top5: [95, 100], top25: [90, 95], average: [82, 90], belowAvg: [0, 82] },
    ],
  },
];

export interface PercentileResult {
  metric: string;
  metricHe: string;
  value: number;
  percentileLabel: string; // "טופ 5%", "טופ 25%", etc.
  percentileRank: number;  // 95, 75, 50, 25
}

export function calculatePercentileRank(
  breedId: string,
  gaitType: string,
  metrics: Record<string, number>
): PercentileResult[] {
  // Find matching benchmarks
  let benchmarkSet = GAIT_BENCHMARKS.find(
    (b) => b.breedId === breedId && b.gaitType === gaitType
  );
  // Fallback to trot generic
  if (!benchmarkSet && (gaitType === "trot" || gaitType === "טרוט")) {
    benchmarkSet = GAIT_BENCHMARKS.find((b) => b.breedId === "_trot");
  }
  if (!benchmarkSet) return [];

  const results: PercentileResult[] = [];

  for (const benchmark of benchmarkSet.benchmarks) {
    const value = metrics[benchmark.metric];
    if (value === undefined || value === null) continue;

    let percentileLabel: string;
    let percentileRank: number;

    if (value >= benchmark.top5[0] && value <= benchmark.top5[1]) {
      percentileLabel = "טופ 5%";
      percentileRank = 95;
    } else if (value >= benchmark.top25[0] && value <= benchmark.top25[1]) {
      percentileLabel = "טופ 25%";
      percentileRank = 75;
    } else if (value >= benchmark.average[0] && value <= benchmark.average[1]) {
      percentileLabel = "ממוצע";
      percentileRank = 50;
    } else {
      percentileLabel = "מתחת לממוצע";
      percentileRank = 25;
    }

    results.push({
      metric: benchmark.metric,
      metricHe: benchmark.metricHe,
      value,
      percentileLabel,
      percentileRank,
    });
  }

  return results;
}
