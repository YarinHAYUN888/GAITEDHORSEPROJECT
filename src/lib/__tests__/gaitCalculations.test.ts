import { describe, it, expect } from "vitest";
import {
  jointDeviation,
  heatColor,
  heatColorRGB,
  getJointHeatColors,
  findJointIssues,
  normalizeKeypoints,
  displaceLeg,
  NORMAL_RANGES,
} from "@/lib/gaitCalculations";

describe("jointDeviation", () => {
  it("returns 0 for value in center of range", () => {
    expect(jointDeviation(147, [135, 160])).toBe(0);
  });

  it("returns 0 for value at edge of range", () => {
    expect(jointDeviation(135, [135, 160])).toBe(0);
  });

  it("returns >0 for value outside range", () => {
    expect(jointDeviation(120, [135, 160])).toBeGreaterThan(0);
  });

  it("caps at 1 for extreme deviation", () => {
    expect(jointDeviation(50, [135, 160])).toBeLessThanOrEqual(1);
  });
});

describe("heatColor", () => {
  it("returns green for 0 deviation", () => {
    expect(heatColor(0)).toBe("#22c55e");
  });

  it("returns non-green for 0.5 deviation", () => {
    const c = heatColor(0.5);
    expect(c).not.toBe("#22c55e");
    expect(c).toMatch(/^rgb\(/);
  });

  it("returns reddish for 1.0 deviation", () => {
    const c = heatColor(1.0);
    expect(c).toMatch(/^rgb\(/);
  });
});

describe("heatColorRGB", () => {
  it("returns green-ish for 0", () => {
    const [r, g, b] = heatColorRGB(0);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("returns 3-element tuple", () => {
    expect(heatColorRGB(0.5)).toHaveLength(3);
  });
});

describe("getJointHeatColors", () => {
  it("returns empty object for undefined input", () => {
    expect(getJointHeatColors(undefined)).toEqual({});
  });

  it("returns colors for valid joint angles", () => {
    const angles = { frontLeft: { shoulder: 95, carpus: 178, fetlock: 150 } };
    const result = getJointHeatColors(angles);
    expect(result.frontLeft).toBeDefined();
    expect(result.frontLeft.shoulder).toHaveProperty("color");
    expect(result.frontLeft.shoulder).toHaveProperty("deviation");
  });
});

describe("findJointIssues", () => {
  it("returns empty array for undefined", () => {
    expect(findJointIssues(undefined)).toEqual([]);
  });

  it("returns empty for in-range values", () => {
    const angles = { frontLeft: { shoulder: 95, carpus: 178, fetlock: 150 } };
    expect(findJointIssues(angles)).toEqual([]);
  });

  it("detects out-of-range joints (>5 beyond)", () => {
    const angles = { frontLeft: { fetlock: 120 } }; // normal is 135-160, 120 < 130
    const issues = findJointIssues(angles);
    expect(issues.length).toBe(1);
    expect(issues[0].joint).toBe("fetlock");
    expect(issues[0].leg).toBe("frontLeft");
  });
});

describe("normalizeKeypoints", () => {
  it("returns input unchanged if fewer than 2 points", () => {
    const kp = { detected: true, frontLeft: { hoof: [100, 200] as [number, number] } };
    const result = normalizeKeypoints(kp, 400, 300);
    expect(result.frontLeft?.hoof).toEqual([100, 200]);
  });

  it("normalizes points to fit within canvas", () => {
    const kp = {
      detected: true,
      frontLeft: { shoulder: [10, 10] as [number, number], hoof: [10, 100] as [number, number] },
      frontRight: { shoulder: [50, 10] as [number, number], hoof: [50, 100] as [number, number] },
    };
    const result = normalizeKeypoints(kp, 400, 300);
    // Points should be within 0..400 and 0..300
    expect(result.frontLeft?.shoulder![0]).toBeGreaterThanOrEqual(0);
    expect(result.frontLeft?.shoulder![0]).toBeLessThanOrEqual(400);
    expect(result.frontRight?.hoof![1]).toBeLessThanOrEqual(300);
  });
});

describe("displaceLeg", () => {
  it("returns undefined for undefined input", () => {
    expect(displaceLeg(undefined, 0, 10)).toBeUndefined();
  });

  it("displaces hoof more than shoulder", () => {
    const kp = {
      shoulder: [100, 100] as [number, number],
      hoof: [100, 200] as [number, number],
    };
    const result = displaceLeg(kp, 0.25, 20);
    expect(result).toBeDefined();
    // Hoof displacement factor=1.0 vs shoulder=0.05
    const shoulderDelta = Math.abs(result!.shoulder![1] - 100);
    const hoofDelta = Math.abs(result!.hoof![1] - 200);
    expect(hoofDelta).toBeGreaterThan(shoulderDelta);
  });
});
