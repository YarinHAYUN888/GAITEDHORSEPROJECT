import { describe, it, expect } from "vitest";
import { FEIF_TESTS, mapToFEIFScores, getRelevantFEIFTests } from "@/data/feifStandards";

describe("FEIF_TESTS data integrity", () => {
  it("each test has weights summing to 1.0", () => {
    for (const test of FEIF_TESTS) {
      const sum = test.criteria.reduce((s, c) => s + c.weight, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it("all threshold ranges are ordered [low, high]", () => {
    for (const test of FEIF_TESTS) {
      for (const c of test.criteria) {
        for (const [, range] of Object.entries(c.thresholds)) {
          expect(range[0]).toBeLessThanOrEqual(range[1]);
        }
      }
    }
  });
});

describe("mapToFEIFScores", () => {
  it("returns null for invalid test ID", () => {
    expect(mapToFEIFScores("INVALID", {})).toBeNull();
  });

  it("returns high scores for excellent metrics (T1)", () => {
    const result = mapToFEIFScores("T1", {
      rhythmRegularity: 97,
      symmetryScore: 96,
      lateralSync: 98,
      overallScore: 95,
    });
    expect(result).not.toBeNull();
    expect(result!.totalScore).toBeGreaterThanOrEqual(8);
    expect(result!.warnings).toHaveLength(0);
  });

  it("returns low scores with warnings for poor metrics (T1)", () => {
    const result = mapToFEIFScores("T1", {
      rhythmRegularity: 40,
      symmetryScore: 35,
      overallScore: 30,
    });
    expect(result).not.toBeNull();
    expect(result!.totalScore).toBeLessThan(5);
    expect(result!.warnings.length).toBeGreaterThan(0);
  });

  it("handles F1 pace test with suspension ratio", () => {
    const result = mapToFEIFScores("F1", {
      lateralSync: 98,
      suspensionRatio: 0.48,
      symmetryScore: 95,
      overallScore: 90,
    });
    expect(result).not.toBeNull();
    expect(result!.testId).toBe("F1");
    expect(result!.criterionScores.length).toBe(5);
  });

  it("scores are clamped between 0 and 10", () => {
    const result = mapToFEIFScores("T1", {
      rhythmRegularity: 100,
      symmetryScore: 100,
      overallScore: 100,
    });
    for (const c of result!.criterionScores) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(10);
    }
  });
});

describe("getRelevantFEIFTests", () => {
  it("returns T1,T2 for tölt", () => {
    expect(getRelevantFEIFTests("tölt")).toEqual(["T1", "T2"]);
  });

  it("returns T1,T2 for tolt (no umlaut)", () => {
    expect(getRelevantFEIFTests("tolt")).toEqual(["T1", "T2"]);
  });

  it("returns F1 for pace", () => {
    expect(getRelevantFEIFTests("pace")).toEqual(["F1"]);
  });

  it("returns F1 for אנדדורה", () => {
    expect(getRelevantFEIFTests("אנדדורה")).toEqual(["F1"]);
  });

  it("returns empty for walk", () => {
    expect(getRelevantFEIFTests("walk")).toEqual([]);
  });

  it("returns T1 for running_walk", () => {
    expect(getRelevantFEIFTests("running_walk")).toEqual(["T1"]);
  });
});
