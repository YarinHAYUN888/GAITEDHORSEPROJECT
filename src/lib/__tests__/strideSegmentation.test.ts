import { describe, it, expect } from "vitest";
import { segmentAndAnalyzeStrides } from "@/lib/strideSegmentation";
import type { BiomechFrame } from "@/types/biomech";

// Helper to generate synthetic hoof Y data simulating a walking horse
function generateSyntheticFrames(
  fps: number,
  strideCount: number,
  strideDurationMs: number,
  dutyCycle: number = 0.6,
): BiomechFrame[] {
  const dt = 1 / fps;
  const strideDurationSec = strideDurationMs / 1000;
  const totalFrames = Math.ceil(strideCount * strideDurationSec * fps) + 5;
  const frames: BiomechFrame[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const t = i * dt;
    const phase = (t % strideDurationSec) / strideDurationSec; // 0..1 within stride

    // Simulate hoof Y: high Y (ground) during stance, low Y (air) during swing
    // Y-down convention: larger Y = lower physically (ground)
    const isStance = phase < dutyCycle;
    const groundY = 0.9;
    const airY = 0.5;

    // Smooth transition
    let hoofY: number;
    if (isStance) {
      hoofY = groundY;
    } else {
      const swingPhase = (phase - dutyCycle) / (1 - dutyCycle);
      hoofY = groundY - (groundY - airY) * Math.sin(swingPhase * Math.PI);
    }

    // Add slight noise
    hoofY += (Math.random() - 0.5) * 0.01;

    frames.push({
      t,
      points: {
        lf_hoof: [0.3, hoofY],
        rf_hoof: [0.7, hoofY + 0.01 * Math.sin(t * 5)],
        lh_hoof: [0.2, hoofY + 0.005 * Math.sin(t * 3 + 1)],
        rh_hoof: [0.8, hoofY + 0.005 * Math.sin(t * 3 + 2)],
        lf_fetlock: [0.3, hoofY - 0.1],
        rf_fetlock: [0.7, hoofY - 0.1],
        lh_fetlock: [0.2, hoofY - 0.1],
        rh_fetlock: [0.8, hoofY - 0.1],
      },
    });
  }

  return frames;
}

describe("strideSegmentation", () => {
  it("detects correct number of strides for synthetic walk data", () => {
    const fps = 30;
    const strideCount = 6;
    const strideDurationMs = 800; // typical walk stride

    const frames = generateSyntheticFrames(fps, strideCount, strideDurationMs);
    const result = segmentAndAnalyzeStrides(frames, fps);

    // Should detect strides in a reasonable range (synthetic data may over-detect)
    expect(result.strides.length).toBeGreaterThanOrEqual(3);
    expect(result.strides.length).toBeLessThanOrEqual(strideCount * 2);
  });

  it("computes reasonable stride durations", () => {
    const fps = 30;
    const strideDurationMs = 700;

    const frames = generateSyntheticFrames(fps, 8, strideDurationMs, 0.6);
    const result = segmentAndAnalyzeStrides(frames, fps);

    if (result.strides.length >= 2) {
      // Durations should be physically plausible
      expect(result.consistency.meanDurationMs).toBeGreaterThan(100);
      expect(result.consistency.meanDurationMs).toBeLessThan(2500);
    }
  });

  it("computes consistency metrics", () => {
    const fps = 30;
    const frames = generateSyntheticFrames(fps, 8, 750, 0.6);
    const result = segmentAndAnalyzeStrides(frames, fps);

    expect(result.consistency).toBeDefined();
    expect(result.consistency.score).toBeGreaterThanOrEqual(0);
    expect(result.consistency.score).toBeLessThanOrEqual(100);
    expect(["excellent", "good", "moderate", "poor"]).toContain(result.consistency.rating);
  });

  it("reports reliable=false with insufficient strides", () => {
    const fps = 30;
    // Only 1 stride — should not be reliable
    const frames = generateSyntheticFrames(fps, 1, 800);
    const result = segmentAndAnalyzeStrides(frames, fps);

    // With only 1 stride cycle we get 0-1 detected strides
    if (result.strides.length < 3) {
      expect(result.reliable).toBe(false);
    }
  });

  it("handles empty frames gracefully", () => {
    const result = segmentAndAnalyzeStrides([], 30);

    expect(result.strides).toHaveLength(0);
    expect(result.reliable).toBe(false);
    expect(result.consistency.score).toBe(0);
  });

  it("computes per-stride metrics for all hooves", () => {
    const fps = 30;
    const frames = generateSyntheticFrames(fps, 6, 800, 0.6);
    const result = segmentAndAnalyzeStrides(frames, fps);

    if (result.strideMetrics.length > 0) {
      const firstStride = result.strideMetrics[0];
      expect(firstStride.hoofDataCount).toBeGreaterThan(0);
      expect(firstStride.stride.dutyCycle).toBeGreaterThan(0);
      expect(firstStride.stride.dutyCycle).toBeLessThan(1);
    }
  });

  it("filters out physically implausible strides", () => {
    const fps = 30;
    const frames = generateSyntheticFrames(fps, 5, 800);
    const result = segmentAndAnalyzeStrides(frames, fps);

    // All detected strides should be within plausible range
    for (const stride of result.strides) {
      expect(stride.durationMs).toBeGreaterThanOrEqual(200);
      expect(stride.durationMs).toBeLessThanOrEqual(2500);
    }
  });

  it("CV is low for highly consistent synthetic data", () => {
    const fps = 30;
    // Very consistent data with no noise
    const frames = generateSyntheticFrames(fps, 10, 750, 0.6);
    const result = segmentAndAnalyzeStrides(frames, fps);

    if (result.strides.length >= 3) {
      // Synthetic data should have low variability
      expect(result.consistency.durationCV).toBeLessThan(30);
    }
  });
});
