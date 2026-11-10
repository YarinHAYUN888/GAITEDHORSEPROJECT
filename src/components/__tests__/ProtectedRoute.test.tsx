import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
const mockUseAuth = vi.mocked(useAuth);

describe("ProtectedRoute", () => {
  it("shows loading spinner when loading", () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, loading: true, signOut: vi.fn() });
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    // Loader2 renders as SVG, check for spinner
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects to /auth when no user", () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders children when user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@test.com" } as any,
      session: {} as any,
      loading: false,
      signOut: vi.fn(),
    });
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
