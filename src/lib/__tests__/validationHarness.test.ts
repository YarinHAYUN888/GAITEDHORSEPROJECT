/**
 * Validation Harness — CI-ready accuracy metrics
 * Runs biomech decision engine against golden fixtures and computes:
 * - Confusion matrix, Accuracy, Precision/Recall per class
 * - Macro-F1, Cohen's Kappa
 * - Threshold policy: CI_INTERNAL (fails CI) vs PRODUCT_TARGET (warning only)
 */
import { describe, it, expect } from "vitest";
import { goldenCases, type GoldenCase } from "@/test/fixtures/goldenOutputs";
import { classifyFromFeatures } from "@/lib/biomechanics";
import type { GaitClassification } from "@/types/biomech";

// ── Threshold Policy ──
const CI_THRESHOLDS = {
  macroF1: 0.70,
  kappa: 0.55,
  accuracy: 0.80,
};

const PRODUCT_TARGETS = {
  macroF1: 0.80,
  kappa: 0.70,
};

// ── Metric Computation ──
function computeConfusionMatrix(predictions: string[], actuals: string[]) {
  const classes = [...new Set([...predictions, ...actuals])];
  const matrix: Record<string, Record<string, number>> = {};
  for (const c of classes) {
    matrix[c] = {};
    for (const c2 of classes) matrix[c][c2] = 0;
  }
  for (let i = 0; i < predictions.length; i++) {
    matrix[predictions[i]][actuals[i]] = (matrix[predictions[i]][actuals[i]] || 0) + 1;
  }
  return { matrix, classes };
}

function computeMetrics(predictions: string[], actuals: string[]) {
  const { matrix, classes } = computeConfusionMatrix(predictions, actuals);
  const n = predictions.length;

  // Accuracy
  let correct = 0;
  for (let i = 0; i < n; i++) if (predictions[i] === actuals[i]) correct++;
  const accuracy = n > 0 ? correct / n : 0;

  // Per-class precision, recall, F1
  const perClass: Record<string, { precision: number; recall: number; f1: number }> = {};
  let f1Sum = 0;
  let classCount = 0;
  for (const cls of classes) {
    let tp = matrix[cls]?.[cls] || 0;
    let fp = 0, fn = 0;
    for (const c2 of classes) {
      if (c2 !== cls) {
        fp += matrix[cls]?.[c2] || 0;
        fn += matrix[c2]?.[cls] || 0;
      }
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    perClass[cls] = { precision, recall, f1 };
    if (tp + fn > 0) { f1Sum += f1; classCount++; }
  }
  const macroF1 = classCount > 0 ? f1Sum / classCount : 0;

  // Cohen's Kappa
  let pe = 0;
  for (const cls of classes) {
    const predCount = predictions.filter(p => p === cls).length;
    const actCount = actuals.filter(a => a === cls).length;
    pe += (predCount / n) * (actCount / n);
  }
  const kappa = pe < 1 ? (accuracy - pe) / (1 - pe) : 1;

  return { accuracy, macroF1, kappa, perClass };
}

// ── Tests ──
describe("Validation Harness — CI Accuracy Metrics", () => {
  const tier2Cases = goldenCases.filter(g => g.tier >= 2);

  const predictions: string[] = [];
  const actuals: string[] = [];

  for (const golden of tier2Cases) {
    const result = classifyFromFeatures(golden.features, golden.breedId);
    predictions.push(result.classification);
    actuals.push(golden.expected.classification);
  }

  const metrics = computeMetrics(predictions, actuals);

  it(`Accuracy >= ${CI_THRESHOLDS.accuracy} (got ${metrics.accuracy.toFixed(3)})`, () => {
    expect(metrics.accuracy).toBeGreaterThanOrEqual(CI_THRESHOLDS.accuracy);
  });

  it(`Macro-F1 >= ${CI_THRESHOLDS.macroF1} (got ${metrics.macroF1.toFixed(3)})`, () => {
    expect(metrics.macroF1).toBeGreaterThanOrEqual(CI_THRESHOLDS.macroF1);
  });

  it(`Cohen's Kappa >= ${CI_THRESHOLDS.kappa} (got ${metrics.kappa.toFixed(3)})`, () => {
    expect(metrics.kappa).toBeGreaterThanOrEqual(CI_THRESHOLDS.kappa);
  });

  // Per-case classification check
  for (const golden of tier2Cases) {
    it(`${golden.id}: ${golden.description} → ${golden.expected.classification}`, () => {
      const result = classifyFromFeatures(golden.features, golden.breedId);
      expect(result.classification).toBe(golden.expected.classification);
      expect(result.confidence).toBeGreaterThanOrEqual(golden.expected.confidenceMin);
      expect(result.confidence).toBeLessThanOrEqual(golden.expected.confidenceMax);
    });
  }

  // Product target warnings (don't fail CI)
  it("PRODUCT TARGET: Macro-F1 report", () => {
    if (metrics.macroF1 < PRODUCT_TARGETS.macroF1) {
      console.warn(`⚠️ Product target: macroF1=${metrics.macroF1.toFixed(3)} < ${PRODUCT_TARGETS.macroF1}`);
    }
    expect(true).toBe(true); // Always passes
  });

  it("PRODUCT TARGET: Kappa report", () => {
    if (metrics.kappa < PRODUCT_TARGETS.kappa) {
      console.warn(`⚠️ Product target: kappa=${metrics.kappa.toFixed(3)} < ${PRODUCT_TARGETS.kappa}`);
    }
    expect(true).toBe(true);
  });
});
