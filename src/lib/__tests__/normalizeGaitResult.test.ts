import { describe, it, expect } from "vitest";
import { normalizeGaitResult } from "../normalizeGaitResult";
import { mockHealthyHorseResult } from "@/test/fixtures/gaitAnalysisResult";
describe("AI narrative normalization", () => {
  it("renders structured notes without changing scores", () => {
    const input = { ...mockHealthyHorseResult, breedSpecificNotes: { dmt3: "Genotype unknown" } };
    const output = normalizeGaitResult(input as unknown as typeof mockHealthyHorseResult);
    expect(output.breedSpecificNotes).toBe("Genotype unknown");
    expect(output.overallScore).toBe(mockHealthyHorseResult.overallScore);
  });
  it("filters malformed windows and normalizes fusion narratives", () => {
    const input = { ...mockHealthyHorseResult, biomechMetrics: { windows: [null, { quality: NaN }, { quality: 0.8, features: { beatEvenness: 0.9 } }] }, multiModalFusion: { conflictDescription: { reason: "Conflict" }, limitations: "bad", conflictReasonCodes: null } };
    const output = normalizeGaitResult(input as unknown as typeof mockHealthyHorseResult);
    expect(output.biomechMetrics?.windows).toHaveLength(1);
    expect(output.multiModalFusion?.conflictDescription).toBe("Conflict");
    expect(output.multiModalFusion?.limitations).toEqual([]);
  });
});