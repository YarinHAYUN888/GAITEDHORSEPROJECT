import { describe, expect, it } from "vitest";
import { canSuspendAccount } from "../../../supabase/functions/admin-workspace/policy";

describe("admin account safety", () => {
  it("does not allow suspending your own account", () => {
    expect(canSuspendAccount("netanel", "netanel", false)).toBe(false);
  });
  it("does not allow suspending another administrator", () => {
    expect(canSuspendAccount("netanel", "other-admin", true)).toBe(false);
  });
  it("allows managing a different ordinary account", () => {
    expect(canSuspendAccount("netanel", "ordinary-user", false)).toBe(true);
  });
});