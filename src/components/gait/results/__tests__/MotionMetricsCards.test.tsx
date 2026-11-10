import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import MotionMetricsCards from "../MotionMetricsCards";
import { mockHealthyHorseResult, mockLameHorseResult } from "@/test/fixtures/gaitAnalysisResult";

const wrap = (ui: React.ReactElement) => render(<LanguageProvider><TooltipProvider>{ui}</TooltipProvider></LanguageProvider>);

describe("MotionMetricsCards", () => {
  it("renders all 4 metric cards in vision mode", () => {
    wrap(<MotionMetricsCards result={mockHealthyHorseResult} analysisMode="vision" />);
    expect(screen.getByText("סינכרון לטרלי %")).toBeInTheDocument();
    expect(screen.getByText("SI — מדד סימטריה")).toBeInTheDocument();
    expect(screen.getByText("פתיחת רגליים")).toBeInTheDocument();
    expect(screen.getByText("דפוס פעימות")).toBeInTheDocument();
  });

  it("shows placeholder in audio-only mode", () => {
    wrap(<MotionMetricsCards result={mockHealthyHorseResult} analysisMode="audio" />);
    expect(screen.getByText(/מדדים ויזואליים/)).toBeInTheDocument();
    expect(screen.queryByText("סינכרון לטרלי %")).not.toBeInTheDocument();
  });

  it("shows high lameness risk for lame horse", () => {
    wrap(<MotionMetricsCards result={mockLameHorseResult} analysisMode="both" />);
    expect(screen.getByText("סיכון גבוה")).toBeInTheDocument();
  });

  it("shows dirty beat warning when isDirty", () => {
    const dirtyResult = {
      ...mockHealthyHorseResult,
      beatTracker: { ...mockHealthyHorseResult.beatTracker, isDirty: true, offsetPercentage: 15 },
    };
    wrap(<MotionMetricsCards result={dirtyResult} analysisMode="vision" />);
    expect(screen.getByText(/צעד מלוכלך/)).toBeInTheDocument();
  });
});
