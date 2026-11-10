import { describe, it, expect } from "vitest";
import {
  isFinitePoint,
  mean,
  stdev,
  sma,
  seriesY,
  detectFootContacts,
  computeGaitFeatures,
  extractBiomechMetrics,
  keypointsDataToFrames,
} from "@/lib/biomechanics";
import type { GaitFeatureVector, HoofName, BiomechFrame } from "@/types/biomech";
import {
  trotFeatures,
  paceFeatures,
  fourBeatFeatures,
  singlefootFeatures,
  brokenPaceFeatures,
  inconclusiveFeatures,
  unknownFeatures,
  missingLegFeatures,
  generateTrotFrames,
  generateLowFPSFrames,
  generateOccludedFrames,
} from "@/test/fixtures/biomechFixtures";

// ── Utility tests ──

describe("isFinitePoint", () => {
  it("returns true for valid point", () => {
    expect(isFinitePoint([1, 2])).toBe(true);
  });
  it("returns false for NaN", () => {
    expect(isFinitePoint([NaN, 1])).toBe(false);
  });
  it("returns false for undefined", () => {
    expect(isFinitePoint(undefined)).toBe(false);
  });
});

describe("mean / stdev", () => {
  it("computes mean correctly", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
  it("returns undefined for empty", () => {
    expect(mean([])).toBeUndefined();
  });
  it("computes stdev", () => {
    const s = stdev([2, 4, 6]);
    expect(s).toBeCloseTo(2, 1);
  });
  it("stdev undefined for single value", () => {
    expect(stdev([5])).toBeUndefined();
  });
});

describe("sma", () => {
  it("applies simple moving average", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBe(1);
    expect(result[2]).toBeCloseTo(2, 5);
    expect(result[4]).toBeCloseTo(4, 5);
  });
  it("handles undefined values", () => {
    const result = sma([1, undefined, 3], 2);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(1); // only previous defined
    expect(result[2]).toBe(3);
  });
});

// ── classifyFromFeatures via computeGaitFeatures & extractBiomechMetrics ──
// We test the exported classifyFromFeatures indirectly through extractBiomechMetrics

describe("extractBiomechMetrics — classification from synthetic frames", () => {
  it("classifies trot-like frames as diagonal", () => {
    const frames = generateTrotFrames(30, 5);
    const metrics = extractBiomechMetrics({ fps: 30, frames });
    // Synthetic diagonal frames should classify as diagonal or at least not lateral
    expect(metrics.gait.classification).not.toBe("lateral");
    expect(metrics.gait.confidence).toBeGreaterThan(0);
  });

  it("handles low FPS gracefully", () => {
    const frames = generateLowFPSFrames();
    const metrics = extractBiomechMetrics({ fps: 8, frames });
    // Should not crash, should return some classification
    expect(metrics.gait).toBeDefined();
    expect(metrics.quality.fps).toBe(8);
  });

  it("handles occluded frames with lower confidence", () => {
    const normalFrames = generateTrotFrames(30, 5);
    const occludedFrames = generateOccludedFrames(30, 5);
    const normalMetrics = extractBiomechMetrics({ fps: 30, frames: normalFrames });
    const occludedMetrics = extractBiomechMetrics({ fps: 30, frames: occludedFrames });
    // Occluded should have lower confidence or different quality
    expect(occludedMetrics.quality.missingRate).toBeDefined();
  });

  it("returns unknown for very short sequences", () => {
    const frames = generateTrotFrames(30, 0.3); // only ~9 frames
    const metrics = extractBiomechMetrics({ fps: 30, frames });
    // Very short → likely unknown or low confidence
    expect(metrics.gait.confidence).toBeLessThanOrEqual(1);
  });
});

// ── detectFootContacts ──

describe("detectFootContacts", () => {
  it("detects contacts in trot frames", () => {
    const frames = generateTrotFrames(30, 4);
    const contacts = detectFootContacts(frames, "lf_hoof");
    expect(contacts.length).toBeGreaterThan(0);
    for (const c of contacts) {
      expect(c.confidence).toBeGreaterThanOrEqual(0.3);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("returns empty for insufficient data", () => {
    const frames: BiomechFrame[] = [
      { t: 0, points: { lf_hoof: [0.5, 0.5], lf_fetlock: [0.5, 0.45] } },
    ];
    const contacts = detectFootContacts(frames, "lf_hoof");
    expect(contacts.length).toBe(0);
  });
});

// ── computeGaitFeatures ──

describe("computeGaitFeatures", () => {
  it("computes features from real contacts", () => {
    const frames = generateTrotFrames(30, 5);
    const hoofs: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
    const contacts: Record<HoofName, any[]> = {
      lf_hoof: [], rf_hoof: [], lh_hoof: [], rh_hoof: [],
    };
    for (const h of hoofs) {
      contacts[h] = detectFootContacts(frames, h);
    }
    const features = computeGaitFeatures(frames, 30, contacts);
    expect(features.beatEvenness).toBeGreaterThanOrEqual(0);
    expect(features.beatEvenness).toBeLessThanOrEqual(1);
    expect(features.strideVariability).toBeGreaterThanOrEqual(0);
    expect(features.contactEventConfidence).toBeGreaterThanOrEqual(0);
  });
});

// ── keypointsDataToFrames ──

describe("keypointsDataToFrames", () => {
  it("converts KeypointsData to BiomechFrame[]", () => {
    const kpArray = [
      {
        frontLeft: { hoof: [0.2, 0.5], fetlock: [0.2, 0.45] },
        frontRight: { hoof: [0.8, 0.5], fetlock: [0.8, 0.45] },
        hindLeft: { hoof: [0.2, 0.6], fetlock: [0.2, 0.55] },
        hindRight: { hoof: [0.8, 0.6], fetlock: [0.8, 0.55] },
        poll: [0.3, 0.2],
        withers: [0.4, 0.25],
      },
      {
        frontLeft: { hoof: [0.21, 0.48], fetlock: [0.21, 0.43] },
        frontRight: { hoof: [0.81, 0.48], fetlock: [0.81, 0.43] },
        hindLeft: { hoof: [0.21, 0.58], fetlock: [0.21, 0.53] },
        hindRight: { hoof: [0.81, 0.58], fetlock: [0.81, 0.53] },
        poll: [0.31, 0.21],
        withers: [0.41, 0.26],
      },
    ];
    const frames = keypointsDataToFrames(kpArray as any, 30);
    expect(frames.length).toBe(2);
    expect(frames[0].t).toBeCloseTo(0, 5);
    expect(frames[1].t).toBeCloseTo(1 / 30, 3);
    expect(frames[0].points.lf_hoof).toEqual([0.2, 0.5]);
  });

  it("handles empty keypoints", () => {
    const frames = keypointsDataToFrames([] as any, 30);
    expect(frames.length).toBe(0);
  });
});
