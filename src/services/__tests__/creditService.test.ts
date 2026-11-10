// Tests for creditService

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: any[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: any[]) => {
            mockEq(...eqArgs);
            return { maybeSingle: mockMaybeSingle };
          },
        };
      },
      insert: (...args: any[]) => {
        mockInsert(...args);
        return { error: null };
      },
      update: (...args: any[]) => {
        mockUpdate(...args);
        return {
          eq: () => ({ error: null }),
        };
      },
    }),
  },
}));

vi.mock("@/types/pipeline", () => ({
  ANALYSIS_COSTS: { both: 5, audio: 1, vision: 3 },
}));

import { calculateCost, checkCredits } from "@/services/creditService";

describe("creditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateCost", () => {
    it("returns correct cost for known modes", () => {
      expect(calculateCost("both")).toBe(5);
      expect(calculateCost("audio")).toBe(1);
      expect(calculateCost("vision")).toBe(3);
    });

    it("returns default cost for unknown mode", () => {
      expect(calculateCost("unknown")).toBe(5);
    });
  });

  describe("checkCredits", () => {
    it("allows when enough credits", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { credits_remaining: 20, credits_total: 20, tier: "free", reset_at: null },
        error: null,
      });

      const result = await checkCredits("user-1", "both");
      expect(result.allowed).toBe(true);
      expect(result.degraded).toBe(false);
      expect(result.cost).toBe(5);
    });

    it("degrades when partial credits available", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { credits_remaining: 2, credits_total: 20, tier: "free", reset_at: null },
        error: null,
      });

      const result = await checkCredits("user-1", "both");
      expect(result.allowed).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.cost).toBe(1);
    });

    it("denies when zero credits", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { credits_remaining: 0, credits_total: 20, tier: "free", reset_at: null },
        error: null,
      });

      const result = await checkCredits("user-1", "both");
      expect(result.allowed).toBe(false);
    });
  });
});
