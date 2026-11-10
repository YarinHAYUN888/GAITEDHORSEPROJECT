import { describe, expect, it } from "vitest";
import { performFFT } from "../audioProcessing";
describe("FFT audio processing", () => {
  it("finds the dominant frequency without quadratic processing", () => {
    const sampleRate = 8192;
    const data = Float32Array.from({ length: sampleRate * 2 }, (_, i) => Math.sin(2 * Math.PI * 500 * i / sampleRate));
    const start = performance.now();
    const result = performFFT({ sampleRate, getChannelData: () => data } as unknown as AudioBuffer);
    expect(result.dominantFrequencies[0]).toBe(500);
    expect(performance.now() - start).toBeLessThan(1000);
  });
  it("short audio has no fabricated frequencies", () => {
    const result = performFFT({ sampleRate: 44100, getChannelData: () => new Float32Array(20) } as unknown as AudioBuffer);
    expect(result.dominantFrequencies).toEqual([]); expect(result.snr).toBe(0);
  });
});