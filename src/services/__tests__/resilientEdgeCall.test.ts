// Tests for resilientEdgeCall

import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } } }),
    },
  },
}));

// We need to mock import.meta.env
vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

import { PaymentRequiredError, RateLimitError } from "@/services/resilientEdgeCall";

describe("resilientEdgeCall error types", () => {
  it("PaymentRequiredError has correct name", () => {
    const err = new PaymentRequiredError();
    expect(err.name).toBe("PaymentRequiredError");
    expect(err.message).toContain("קרדיטים");
  });

  it("RateLimitError has correct name", () => {
    const err = new RateLimitError();
    expect(err.name).toBe("RateLimitError");
    expect(err.message).toContain("בקשות");
  });
});

describe("resilientEdgeCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-mock supabase auth after clearing
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { access_token: "test-token" } } });
  });

  it("returns data on successful call", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: "ok" }),
    });

    const { resilientEdgeCall } = await import("@/services/resilientEdgeCall");
    const result = await resilientEdgeCall<{ result: string }>("test-fn", { data: 1 });
    expect(result.result).toBe("ok");
  });

  it("throws PaymentRequiredError on 402", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: () => Promise.resolve({ error: "no credits" }),
    });

    const { resilientEdgeCall } = await import("@/services/resilientEdgeCall");
    await expect(resilientEdgeCall("test-fn", {})).rejects.toThrow(PaymentRequiredError);
  });
});
