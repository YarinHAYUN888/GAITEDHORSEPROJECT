import { describe, expect, it } from "vitest";
import { applyAutomaticSources, usableAudio } from "../../../supabase/functions/_shared/automaticSources";

const audio = { bpm: 120, beatCount: 12, regularity: 85, signalToNoiseRatio: 20 };
describe("production automatic source selector", () => {
  it("accepts both sources only when quality permits", () => {
    const result = applyAutomaticSources({ sourceQuality: { visionUsable: true, audioUsable: true, reason: "Side view and acoustic rhythm" } }, audio);
    expect(result.analysisMode).toBe("both");
    expect(result.sourceSelection.audioBasis).toBe("unverified_acoustic_rhythm_metrics");
  });
  it.each([null, { ...audio, signalToNoiseRatio: 5 }, { ...audio, beatCount: 1 }, { ...audio, regularity: 0 }, { ...audio, signalToNoiseRatio: undefined }])("rejects unusable audio %j", metrics => {
    expect(usableAudio(metrics)).toBe(false);
    const result = applyAutomaticSources({ sourceQuality: { visionUsable: true, audioUsable: true }, audioAnalysis: {} }, metrics);
    expect(result.analysisMode).toBe("vision"); expect(result.audioAnalysis).toBeUndefined();
  });
  it("audio only does not fabricate visual scores or gait labels", () => {
    const result = applyAutomaticSources({ sourceQuality: { visionUsable: false, audioUsable: true }, overallScore: 85, gaitType: "pace", kinematicMetrics: {}, motionForecast: {}, audioAnalysis: { detectedBPM: 120 } }, audio);
    expect(result.analysisMode).toBe("audio"); expect(result.overallScore).toBeNull();
    expect(result.symmetry.score).toBeNull(); expect(result.gaitType).toBe("unknown");
    expect(result.kinematicMetrics).toBeUndefined(); expect(result.motionForecast).toBeUndefined();
    expect(result.audioAnalysis.detectedBPM).toBe(120);
  });
  it("missing evidence remains inconclusive", () => {
    const result = applyAutomaticSources({ gaitType: "trot", confidence: 90 }, null);
    expect(result.sourceSelection.visionUsed).toBe(false); expect(result.confidence).toBe(0);
  });
});