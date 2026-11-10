import { describe, it, expect } from "vitest";
import { trendOf, buildSummary } from "../ownerInsight";

describe("ownerInsight", () => {
  it("treats changes under 3 points as flat", () => {
    expect(trendOf(82, 80)).toBe("flat");
    expect(trendOf(85, 80)).toBe("up");
    expect(trendOf(70, 80)).toBe("down");
    expect(trendOf(70, null)).toBeNull();
  });
  it("warns on low confidence", () => {
    expect(buildSummary({ gaitType: "tölt", symmetry: 90, lateralSync: 50, confidence: 40 }, "en")).toContain("re-filming");
    expect(buildSummary({ gaitType: "tölt", symmetry: 90, lateralSync: 50, confidence: 80 }, "en")).not.toContain("re-filming");
  });
});
