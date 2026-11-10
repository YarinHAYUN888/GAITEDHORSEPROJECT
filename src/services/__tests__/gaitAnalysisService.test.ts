import { describe, it, expect, vi } from "vitest";
import { mockHealthyHorseResult } from "@/test/fixtures/gaitAnalysisResult";
const mocks = vi.hoisted(() => ({ call: vi.fn(), insert: vi.fn(), single: vi.fn() }));
vi.mock("@/services/edgeFunctionClient", () => ({ callEdgeFunction: mocks.call }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
import { analyzeGait, analyzeGaitCombined, saveGaitAnalysis } from "../gaitAnalysisService";
describe("Analysis response and persistence stability", () => {
  it("rejects a missing quick response before result display", async () => {
    mocks.call.mockResolvedValueOnce({ analysis: null });
    await expect(analyzeGait({ frames: [] })).rejects.toThrow("incomplete");
  });
  it("rejects a malformed full response", async () => {
    mocks.call.mockResolvedValueOnce({ analysis: { ...mockHealthyHorseResult, extension: null } });
    await expect(analyzeGaitCombined({ frames: [] })).rejects.toThrow("incomplete");
  });
  it("returns a separate save failure on a network exception", async () => {
    mocks.insert.mockReturnValue({ select: () => ({ abortSignal: () => ({ single: mocks.single }) }) });
    mocks.single.mockRejectedValueOnce(new Error("network unavailable"));
    expect(await saveGaitAnalysis(mockHealthyHorseResult, {})).toBeNull();
    expect(mockHealthyHorseResult.overallScore).toBe(88);
  });
});