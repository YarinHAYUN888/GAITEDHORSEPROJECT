import { describe, it, expect } from "vitest";
import { analyzeCameraMotion } from "@/lib/opticalFlowValidation";
import type { BiomechFrame, Point2 } from "@/types/biomech";

function makeFrame(t: number, offsetX: number, offsetY: number): BiomechFrame {
  return {
    t,
    points: {
      withers: [0.4 + offsetX, 0.25 + offsetY] as Point2,
      dock: [0.6 + offsetX, 0.3 + offsetY] as Point2,
      lf_hoof: [0.3 + offsetX, 0.6 + offsetY] as Point2,
      rf_hoof: [0.7 + offsetX, 0.6 + offsetY] as Point2,
      lh_hoof: [0.3 + offsetX, 0.7 + offsetY] as Point2,
      rh_hoof: [0.7 + offsetX, 0.7 + offsetY] as Point2,
      poll: [0.35 + offsetX, 0.2 + offsetY] as Point2,
    },
  };
}

describe("analyzeCameraMotion", () => {
  it("returns stable metrics for stationary camera", () => {
    // Horse moves but camera is still → low coherence (limbs move differently)
    const frames: BiomechFrame[] = [];
    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      // Body stays mostly still, hooves oscillate
      frames.push({
        t,
        points: {
          withers: [0.4, 0.25],
          dock: [0.6, 0.3],
          lf_hoof: [0.3 + 0.02 * Math.sin(i * 0.5), 0.6 + 0.03 * Math.sin(i * 0.5)],
          rf_hoof: [0.7 + 0.02 * Math.sin(i * 0.5 + Math.PI), 0.6 + 0.03 * Math.sin(i * 0.5 + Math.PI)],
          lh_hoof: [0.3 + 0.02 * Math.sin(i * 0.5 + Math.PI), 0.7 + 0.03 * Math.sin(i * 0.5 + Math.PI)],
          rh_hoof: [0.7 + 0.02 * Math.sin(i * 0.5), 0.7 + 0.03 * Math.sin(i * 0.5)],
          poll: [0.35, 0.2],
        },
      });
    }
    const result = analyzeCameraMotion(frames, 30);
    expect(result.panningDetected).toBe(false);
    expect(result.cameraStabilityScore).toBeGreaterThan(0.5);
  });

  it("detects panning when all points translate uniformly", () => {
    // All keypoints shift right by same amount each frame = camera panning
    const frames: BiomechFrame[] = [];
    for (let i = 0; i < 30; i++) {
      frames.push(makeFrame(i / 30, i * 0.01, 0));
    }
    const result = analyzeCameraMotion(frames, 30);
    expect(result.panningDetected).toBe(true);
    expect(result.panningFraction).toBeGreaterThan(0.3);
    expect(result.warnings).toContain("camera_panning");
    expect(result.cameraStabilityScore).toBeLessThan(0.8);
  });

  it("handles too few frames gracefully", () => {
    const frames = [makeFrame(0, 0, 0), makeFrame(1 / 30, 0, 0)];
    const result = analyzeCameraMotion(frames, 30);
    expect(result.warnings).toContain("too_few_frames");
  });

  it("estimates horse speed in body-lengths/s", () => {
    const frames: BiomechFrame[] = [];
    for (let i = 0; i < 60; i++) {
      // Horse moves right at constant speed
      frames.push(makeFrame(i / 30, i * 0.005, 0));
    }
    const result = analyzeCameraMotion(frames, 30);
    expect(result.estimatedSpeedBLS).toBeGreaterThan(0);
  });

  it("returns perFrameCoherence array", () => {
    const frames: BiomechFrame[] = [];
    for (let i = 0; i < 20; i++) {
      frames.push(makeFrame(i / 30, 0, 0));
    }
    const result = analyzeCameraMotion(frames, 30);
    expect(result.perFrameCoherence).toBeDefined();
    expect(result.perFrameCoherence!.length).toBe(19); // n-1 transitions
  });
});
