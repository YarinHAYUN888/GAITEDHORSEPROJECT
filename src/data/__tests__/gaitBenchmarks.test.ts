import { describe, it, expect } from "vitest";
import { calculatePercentileRank, GAIT_BENCHMARKS } from "@/data/gaitBenchmarks";

describe("GAIT_BENCHMARKS data integrity", () => {
  it("all ranges are ordered [low, high]", () => {
    for (const breed of GAIT_BENCHMARKS) {
      for (const b of breed.benchmarks) {
        expect(b.top5[0]).toBeLessThanOrEqual(b.top5[1]);
        expect(b.top25[0]).toBeLessThanOrEqual(b.top25[1]);
        expect(b.average[0]).toBeLessThanOrEqual(b.average[1]);
      }
    }
  });
});

describe("calculatePercentileRank", () => {
  it("returns top 5% for excellent lateralSync in icelandic tölt", () => {
    const results = calculatePercentileRank("icelandic", "tölt", { lateralSync: 98 });
    const ls = results.find((r) => r.metric === "lateralSync");
    expect(ls).toBeDefined();
    expect(ls!.percentileRank).toBe(95);
    expect(ls!.percentileLabel).toBe("טופ 5%");
  });

  it("returns below average for low lateralSync", () => {
    const results = calculatePercentileRank("icelandic", "tölt", { lateralSync: 70 });
    const ls = results.find((r) => r.metric === "lateralSync");
    expect(ls).toBeDefined();
    expect(ls!.percentileRank).toBe(25);
  });

  it("returns empty for unknown breed", () => {
    expect(calculatePercentileRank("unknown-breed", "tölt", { lateralSync: 98 })).toEqual([]);
  });

  it("falls back to trot generic for trot gait", () => {
    const results = calculatePercentileRank("unknown", "trot", { diagonalSync: 98 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metric).toBe("diagonalSync");
  });

  it("skips metrics not in input", () => {
    const results = calculatePercentileRank("icelandic", "tölt", { lateralSync: 98 });
    // Only lateralSync provided, so only that metric returned
    expect(results.length).toBe(1);
  });

  it("handles multiple metrics", () => {
    const results = calculatePercentileRank("icelandic", "tölt", {
      lateralSync: 98,
      bpm: 85,
      symmetry: 96,
      rhythmRegularity: 97,
    });
    expect(results.length).toBe(4);
  });
});
