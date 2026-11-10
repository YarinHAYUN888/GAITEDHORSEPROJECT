// Tests for keypointAdapter

import { describe, it, expect } from "vitest";
import { adaptAnimalPoseToHorseKeypoints, computeKeypointJitter } from "@/lib/keypointAdapter";
import type { RawAnimalKeypoint } from "@/workers/poseEngine.worker";

function makeKp(name: string, x: number, y: number, conf: number): RawAnimalKeypoint {
  return { name, x, y, confidence: conf };
}

function makeFullFrame(offsetX = 0): RawAnimalKeypoint[] {
  return [
    makeKp("left_front_paw", 100 + offsetX, 400, 0.9),
    makeKp("right_front_paw", 200 + offsetX, 400, 0.9),
    makeKp("left_elbow", 100, 300, 0.8),
    makeKp("right_elbow", 200, 300, 0.8),
    makeKp("left_shoulder", 100, 200, 0.9),
    makeKp("right_shoulder", 200, 200, 0.9),
    makeKp("left_hind_paw", 300, 400, 0.9),
    makeKp("right_hind_paw", 400, 400, 0.9),
    makeKp("left_knee", 300, 300, 0.8),
    makeKp("right_knee", 400, 300, 0.8),
    makeKp("left_hip", 300, 200, 0.9),
    makeKp("right_hip", 400, 200, 0.9),
  ];
}

describe("adaptAnimalPoseToHorseKeypoints", () => {
  it("converts full frame to detected KeypointsData", () => {
    const result = adaptAnimalPoseToHorseKeypoints([makeFullFrame()]);
    expect(result).toHaveLength(1);
    expect(result[0].detected).toBe(true);
    expect(result[0].frontLeft?.hoof).toBeDefined();
    expect(result[0].frontLeft?.fetlock).toBeDefined();
    expect(result[0].frontLeft?.carpus).toBeDefined();
    expect(result[0].frontLeft?.shoulder).toBeDefined();
    expect(result[0].hindLeft?.hoof).toBeDefined();
    expect(result[0].hindLeft?.stifle).toBeDefined();
    expect(result[0].hindLeft?.hip).toBeDefined();
  });

  it("marks as not detected when fewer than 4 keypoints", () => {
    const sparse = [makeKp("left_front_paw", 100, 400, 0.9)];
    const result = adaptAnimalPoseToHorseKeypoints([sparse]);
    expect(result[0].detected).toBe(false);
  });

  it("filters low confidence keypoints", () => {
    const lowConf = [makeKp("left_front_paw", 100, 400, 0.01)]; // below 0.05 threshold
    const result = adaptAnimalPoseToHorseKeypoints([lowConf]);
    expect(result[0].frontLeft?.hoof).toBeUndefined();
  });
});

describe("computeKeypointJitter", () => {
  it("returns 0 for single frame", () => {
    expect(computeKeypointJitter([makeFullFrame()])).toBe(0);
  });

  it("returns 0 for identical frames", () => {
    const jitter = computeKeypointJitter([makeFullFrame(0), makeFullFrame(0)]);
    expect(jitter).toBe(0);
  });

  it("returns positive for displaced frames", () => {
    const jitter = computeKeypointJitter([makeFullFrame(0), makeFullFrame(10)]);
    expect(jitter).toBeGreaterThan(0);
  });

  it("jitter scales with displacement", () => {
    const small = computeKeypointJitter([makeFullFrame(0), makeFullFrame(1)]);
    const large = computeKeypointJitter([makeFullFrame(0), makeFullFrame(50)]);
    expect(large).toBeGreaterThan(small);
  });
});
