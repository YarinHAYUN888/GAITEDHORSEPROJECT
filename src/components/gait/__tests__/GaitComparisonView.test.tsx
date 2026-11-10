import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import GaitComparisonView from "../GaitComparisonView";
import { mockHealthyHorseResult, mockLameHorseResult } from "@/test/fixtures/gaitAnalysisResult";

const wrap = (ui: React.ReactElement) => <LanguageProvider><TooltipProvider>{ui}</TooltipProvider></LanguageProvider>;

describe("GaitComparisonView", () => {
  it("renders comparison title", () => {
    render(wrap(<GaitComparisonView reference={mockHealthyHorseResult} current={mockLameHorseResult} />));
    expect(screen.getByText(/השוואת ניתוחים/)).toBeInTheDocument();
  });

  it("displays both overall scores", () => {
    render(wrap(<GaitComparisonView reference={mockHealthyHorseResult} current={mockLameHorseResult} />));
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
  });

  it("warns differences are not proven improvement", () => {
    render(wrap(<GaitComparisonView reference={mockHealthyHorseResult} current={mockLameHorseResult} />));
    expect(screen.getByText(/אינם הוכחה/)).toBeInTheDocument();
  });

  it("shows dates when provided", () => {
    render(wrap(
      <GaitComparisonView
        reference={mockHealthyHorseResult}
        current={mockLameHorseResult}
        referenceDate="2025-01-01"
        currentDate="2025-02-01"
      />
    ));
    expect(screen.getByText(/2025-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/2025-02-01/)).toBeInTheDocument();
  });

  it("shows gait type badges", () => {
    render(wrap(<GaitComparisonView reference={mockHealthyHorseResult} current={mockLameHorseResult} />));
    expect(screen.getAllByText("טולט").length).toBeGreaterThanOrEqual(1);
  });
});
