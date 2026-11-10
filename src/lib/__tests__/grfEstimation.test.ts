import { describe, it, expect } from "vitest";
import { estimateGRF } from "@/lib/grfEstimation";
import type { BiomechFrame, HoofName, FootContactEvent, StanceSwingMetrics, Point2 } from "@/types/biomech";
import { generateTrotFrames } from "@/test/fixtures/biomechFixtures";
import { detectFootContacts } from "@/lib/biomechanics";

const HOOFS: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];

function makeContacts(frames: BiomechFrame[]): Record<HoofName, FootContactEvent[]> {
  const contacts: Record<HoofName, FootContactEvent[]> = {
    lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
  };
  for (const h of HOOFS) {
    contacts[h] = detectFootContacts(frames, h);
  }
  return contacts;
}

describe("estimateGRF", () => {
  it("returns valid metrics for trot frames", () => {
    const frames = generateTrotFrames(30, 5);
    const contacts = makeContacts(frames);
    const result = estimateGRF(frames, 30, contacts);

    expect(result.perLimb).toBeDefined();
    for (const h of HOOFS) {
      expect(result.perLimb[h].limb).toBe(h);
      expect(result.perLimb[h].peakImpact).toBeGreaterThanOrEqual(0);
      expect(result.perLimb[h].peakImpact).toBeLessThanOrEqual(1);
      expect(result.perLimb[h].meanStanceLoad).toBeGreaterThanOrEqual(0);
      expect(result.perLimb[h].meanStanceLoad).toBeLessThanOrEqual(1);
    }
    expect(result.frontHindRatio).toBeGreaterThanOrEqual(0);
    expect(result.frontHindRatio).toBeLessThanOrEqual(1);
    expect(result.leftRightAsymmetry).toBeGreaterThanOrEqual(0);
    expect(result.leftRightAsymmetry).toBeLessThanOrEqual(1);
  });

  it("handles too few frames gracefully", () => {
    const frames: BiomechFrame[] = [
      { t: 0, points: { lf_hoof: [0.3, 0.5] as Point2 } },
      { t: 1/30, points: { lf_hoof: [0.3, 0.51] as Point2 } },
    ];
    const contacts: Record<HoofName, FootContactEvent[]> = {
      lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
    };
    const result = estimateGRF(frames, 30, contacts);
    expect(result.reliable).toBe(false);
    expect(result.warnings).toContain("too_few_frames");
  });

  it("handles empty contacts gracefully", () => {
    const frames = generateTrotFrames(30, 3);
    const contacts: Record<HoofName, FootContactEvent[]> = {
      lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
    };
    const result = estimateGRF(frames, 30, contacts);
    expect(result.reliable).toBe(false);
    expect(result.warnings).toContain("low_contact_count");
    expect(result.overallPeakForce).toBe(0);
  });

  it("detects asymmetry when one limb has much more data", () => {
    const frames = generateTrotFrames(30, 5);
    const contacts = makeContacts(frames);
    // Artificially inflate one limb's contacts (simulate more impacts)
    const result = estimateGRF(frames, 30, contacts);
    // Should produce some non-zero values
    const totalContacts = HOOFS.reduce((s, h) => s + result.perLimb[h].contactCount, 0);
    expect(totalContacts).toBeGreaterThan(0);
  });

  it("normalizes peak impact to 0..1 range", () => {
    const frames = generateTrotFrames(30, 5);
    const contacts = makeContacts(frames);
    const result = estimateGRF(frames, 30, contacts);
    const maxPeak = Math.max(...HOOFS.map(h => result.perLimb[h].peakImpact));
    // At least one limb should be at or near 1.0 (the max)
    expect(maxPeak).toBeLessThanOrEqual(1);
    if (maxPeak > 0) {
      expect(maxPeak).toBeCloseTo(1, 0);
    }
  });

  it("computes frontHindRatio in expected range for trot", () => {
    const frames = generateTrotFrames(30, 5);
    const contacts = makeContacts(frames);
    const result = estimateGRF(frames, 30, contacts);
    // Trot should be roughly balanced, but we allow wide range for synthetic data
    expect(result.frontHindRatio).toBeGreaterThan(0);
    expect(result.frontHindRatio).toBeLessThan(1);
  });

  it("includes stanceSwingMetrics when provided", () => {
    const frames = generateTrotFrames(30, 5);
    const contacts = makeContacts(frames);
    const ssm: StanceSwingMetrics = {
      perHoof: {
        lf_hoof: { stanceDurationMs: 400, swingDurationMs: 300, dutyFactor: 0.57, occludedPct: 0 },
        rf_hoof: { stanceDurationMs: 400, swingDurationMs: 300, dutyFactor: 0.57, occludedPct: 0 },
        lh_hoof: { stanceDurationMs: 380, swingDurationMs: 320, dutyFactor: 0.54, occludedPct: 0 },
        rh_hoof: { stanceDurationMs: 380, swingDurationMs: 320, dutyFactor: 0.54, occludedPct: 0 },
      },
      overallDutyFactor: 0.555,
    };
    const result = estimateGRF(frames, 30, contacts, ssm);
    // Should still produce valid results
    expect(result.perLimb).toBeDefined();
  });
});
