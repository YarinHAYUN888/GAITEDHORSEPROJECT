import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AnalysisProgress from "../AnalysisProgress";
const wrap = (ui: React.ReactElement) => render(<LanguageProvider>{ui}</LanguageProvider>);
describe("AnalysisProgress", () => {
  it("shows the actual current stage", () => {
    wrap(<AnalysisProgress currentStage="frames" progress={10} />);
    expect(screen.getByText("חילוץ תמונות")).toBeInTheDocument();
  });
  it("does not fabricate completion from the stage position", () => {
    wrap(<AnalysisProgress currentStage="vision" progress={50} />);
    expect(screen.getByText("0/1 שלבים הסתיימו")).toBeInTheDocument();
  });
  it("shows measured stage duration and settled count", () => {
    wrap(<AnalysisProgress currentStage="vision" progress={50} stages={[{ key: "frames", status: "done", durationMs: 1234 }, { key: "vision", status: "running" }]} />);
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.getByText("1/2 שלבים הסתיימו")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });
});
