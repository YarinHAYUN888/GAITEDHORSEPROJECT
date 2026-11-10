import { describe, it, expect, vi } from "vitest";
import { render as renderBase, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
const render = (ui: React.ReactElement) => renderBase(<LanguageProvider>{ui}</LanguageProvider>);
import AIActionButtons from "../AIActionButtons";
import { mockHealthyHorseResult } from "@/test/fixtures/gaitAnalysisResult";

vi.mock("@/services/expertService", () => ({
  fetchExpertAnalysis: vi.fn().mockResolvedValue("# Expert Result"),
  fetchTrainingPlan: vi.fn().mockResolvedValue("# Training Plan"),
  generateReport: vi.fn().mockResolvedValue("Report content"),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("AIActionButtons", () => {
  it("renders all 3 action buttons", () => {
    render(<AIActionButtons result={mockHealthyHorseResult} />);
    expect(screen.getByText("ניתוח מומחה מפורט")).toBeInTheDocument();
    expect(screen.getByText("תוכנית אימון שבועית")).toBeInTheDocument();
    expect(screen.getByText("הפק תעודת איכות צעד")).toBeInTheDocument();
  });

  it("calls expert analysis on click", async () => {
    render(<AIActionButtons result={mockHealthyHorseResult} horseName="סוסי" />);
    await userEvent.click(screen.getByText("ניתוח מומחה מפורט"));
    expect(await screen.findByText("ניתוח מומחה AI")).toBeInTheDocument();
  });
});
