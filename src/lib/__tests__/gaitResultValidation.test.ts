import { describe, it, expect } from "vitest";
import { isGaitResultValid, requireGaitResult } from "../gaitResultValidation";
import { mockHealthyHorseResult as valid } from "@/test/fixtures/gaitAnalysisResult";

describe("Production result boundary", () => {
  it("preserves valid scores exactly", () => {
    expect(requireGaitResult(valid)).toBe(valid);
  });
  it.each([null, undefined, {}, { ...valid, symmetry: null }, { ...valid, extension: null }, { ...valid, lateralSync: null }])("rejects missing required data: %j", value => {
    expect(isGaitResultValid(value)).toBe(false);
    expect(() => requireGaitResult(value)).toThrow();
  });
  it.each([NaN, Infinity, -1, 101, "90", { value: 90 }])("rejects corrupted scores: %j", confidence => {
    expect(isGaitResultValid({ ...valid, confidence })).toBe(false);
  });
  it("accepts unavailable measurements without inventing zero", () => {
    const result = { ...valid, overallScore: null, symmetry: { ...valid.symmetry, score: null }, extension: { ...valid.extension, quality: null } };
    expect(requireGaitResult(result).overallScore).toBeNull();
  });
  it("rejects malformed contact arrays", () => {
    expect(isGaitResultValid({ ...valid, beatTracker: { ...valid.beatTracker, impactTimes: [null] } })).toBe(false);
  });
});