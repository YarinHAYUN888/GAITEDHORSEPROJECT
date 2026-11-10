import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ScoreHeader from "../ScoreHeader";
import { mockHealthyHorseResult, mockLameHorseResult } from "@/test/fixtures/gaitAnalysisResult";

const wrap = (ui: React.ReactElement) =>
  render(
    <LanguageProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </LanguageProvider>
  );

describe("ScoreHeader", () => {
  const defaults = {
    compositeScore: 80,
    tempoConsistency: 85,
    extensionScore: 75,
    analysisMode: "both" as const,
  };

  it("renders all 5 score circles", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} {...defaults} />);
    expect(screen.getByText("GES — ציון יעילות")).toBeInTheDocument();
    expect(screen.getByText("ביטחון")).toBeInTheDocument();
    expect(screen.getByText("סינכרון לטרלי %")).toBeInTheDocument();
    expect(screen.getByText("SI — מדד סימטריה")).toBeInTheDocument();
    expect(screen.getByText("ציון משוקלל")).toBeInTheDocument();
  });

  it("displays horse name when provided", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} horseName="בלאק" {...defaults} />);
    expect(screen.getByText(/בלאק/)).toBeInTheDocument();
  });

  it("shows analysis mode badge", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} {...defaults} analysisMode="audio" />);
    expect(screen.getByText("אודיו בלבד")).toBeInTheDocument();
  });

  it("shows gait type hebrew badge", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} {...defaults} />);
    expect(screen.getByText("טולט")).toBeInTheDocument();
  });

  it("shows capture quality warning when score < 3", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} {...defaults} captureQuality={{ score: 2, label: "נמוכה", color: "text-red-500", checks: {} }} />);
    expect(screen.getByText(/איכות צילום נמוכה/)).toBeInTheDocument();
  });

  it("does not show capture quality warning when score >= 3", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} {...defaults} captureQuality={{ score: 4, label: "טובה", color: "text-green-500", checks: {} }} />);
    expect(screen.queryByText(/איכות צילום/)).not.toBeInTheDocument();
  });

  it("shows outcome badge for confident result", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} {...defaults} outcome="confident" />);
    expect(screen.getByText("אמין")).toBeInTheDocument();
  });

  it("shows recapture card with tips", () => {
    wrap(<ScoreHeader result={mockHealthyHorseResult} {...defaults} outcome="recapture" reasonCodes={["Q_LOW_BLUR", "Q_NOT_SIDE_VIEW"]} />);
    expect(screen.getByText("צלם מחדש")).toBeInTheDocument();
  });
});
