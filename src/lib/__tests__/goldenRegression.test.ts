/**
 * Golden regression tests — verifies classifier output against 10 canonical cases.
 * Any change to classification logic must still pass these.
 */
import { describe, it, expect } from "vitest";
import { goldenCases } from "@/test/fixtures/goldenOutputs";

import { classifyFromFeatures } from "@/lib/biomechanics";

describe("Golden regression tests", () => {
  for (const golden of goldenCases) {
    it(`${golden.id}: ${golden.description}`, () => {
      const result = classifyFromFeatures(golden.features, golden.breedId);

      // Classification must match expected
      expect(result.classification).toBe(golden.expected.classification);

      // Confidence within range
      expect(result.confidence).toBeGreaterThanOrEqual(golden.expected.confidenceMin);
      expect(result.confidence).toBeLessThanOrEqual(golden.expected.confidenceMax);
    });
  }
});
