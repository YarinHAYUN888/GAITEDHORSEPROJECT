import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdminAccess } from "../useAdminAccess";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "ordinary-user" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
function Probe() { const { isAdmin, loading, error } = useAdminAccess(); return <div>{loading ? "pending" : error ? "denied-error" : isAdmin ? "admin" : "ordinary"}</div>; }
function show() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Probe /></QueryClientProvider>); }
beforeEach(() => { cleanup(); rpc.mockReset(); });
describe("administrator access", () => {
  it("denies an ordinary authenticated user", async () => {
    rpc.mockResolvedValue({ data: false, error: null }); show();
    await waitFor(() => expect(screen.getByText("ordinary")).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "ordinary-user", _role: "admin" });
  });
  it("fails closed if the role lookup fails", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("Unavailable") }); show();
    await waitFor(() => expect(screen.getByText("denied-error")).toBeInTheDocument());
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
  });
  it("allows the workspace only after a server role confirmation", async () => {
    rpc.mockResolvedValue({ data: true, error: null }); show();
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
  });
});