import { describe, it, expect } from "vitest";
import { buildDecisionContext, makeDecision, buildDecisionTrace, buildExplainability } from "@/lib/decisionEngine";
import type { GaitClassification, ConsistencyCriticResult } from "@/types/biomech";
import {
  trotFeatures,
  paceFeatures,
  fourBeatFeatures,
  unknownFeatures,
} from "@/test/fixtures/biomechFixtures";

function makeGait(cls: GaitClassification["classification"], conf: number): GaitClassification {
  return {
    classification: cls,
    confidence: conf,
    alternatives: [{ classification: "lateral", score: 0.2 }],
    classificationReason: "test",
  };
}

describe("makeDecision", () => {
  it("passes through classification without critic", () => {
    const ctx = buildDecisionContext(undefined, "vision", "diagonal", 0.8);
    const gait = makeGait("diagonal", 0.85);
    const result = makeDecision(ctx, gait);
    expect(result.classification).toBe("diagonal");
    expect(result.confidence).toBe(0.85);
    expect(result.criticApproved).toBe(true);
  });

  it("applies critic confidence adjustment", () => {
    const ctx = buildDecisionContext(undefined, "vision");
    const gait = makeGait("lateral", 0.7);
    const critic: ConsistencyCriticResult = {
      approved: false,
      confidenceAdjustment: 0.5,
      alternatives: [],
      reasonCodes: ["TIMING_MISMATCH"],
      contradictions: [],
    };
    const result = makeDecision(ctx, gait, critic);
    expect(result.confidence).toBeCloseTo(0.35, 2);
    expect(result.criticApproved).toBe(false);
    expect(result.criticWarnings).toContain("TIMING_MISMATCH");
  });

  it("overrides classification with strong critic evidence", () => {
    const ctx = buildDecisionContext(undefined, "vision");
    const gait = makeGait("lateral", 0.6);
    const critic: ConsistencyCriticResult = {
      approved: false,
      confidenceAdjustment: 0.8,
      alternatives: [{ classification: "diagonal", score: 0.9 }],
      reasonCodes: [],
      contradictions: [
        { metric: "latLag", observed: 80, expectedRange: "<30" },
        { metric: "diagLag", observed: 10, expectedRange: ">50" },
      ],
    };
    const result = makeDecision(ctx, gait, critic);
    expect(result.classification).toBe("diagonal");
  });
});

describe("buildDecisionTrace", () => {
  it("includes classifier version and ruleset hash", () => {
    const trace = buildDecisionTrace("both", true, true, 0.05);
    expect(trace.classifierVersion).toBeTruthy();
    expect(trace.rulesetHash).toBeTruthy();
    expect(trace.criticUsed).toBe(true);
    expect(trace.breedPriorApplied).toBe(0.05);
    expect(trace.modelVersions).toBeDefined();
  });
});

describe("buildExplainability", () => {
  it("generates evidence for high-quality trot", () => {
    const ctx = buildDecisionContext(undefined, "vision");
    // Override features
    (ctx as any).features = trotFeatures;
    ctx.windowVotes = { diagonal: 5, lateral: 1 };
    const result = makeDecision(ctx, makeGait("diagonal", 0.85));
    const explain = buildExplainability(ctx, result);
    expect(explain.evidenceFor.length).toBeGreaterThan(0);
    expect(explain.evidenceFor.length).toBeLessThanOrEqual(3);
    expect(explain.evidenceAgainst.length).toBeLessThanOrEqual(2);
  });

  it("generates evidence against for poor data", () => {
    const ctx = buildDecisionContext(undefined, "vision");
    (ctx as any).features = unknownFeatures;
    const result = makeDecision(ctx, makeGait("unknown", 0.1));
    const explain = buildExplainability(ctx, result);
    expect(explain.evidenceAgainst.length).toBeGreaterThan(0);
  });
});
