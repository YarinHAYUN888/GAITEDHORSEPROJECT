import { describe, it, expect } from "vitest";
import { render as renderBase, screen } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
const render = (ui: React.ReactElement) => renderBase(<LanguageProvider>{ui}</LanguageProvider>);
import AudioDetailsCard from "../AudioDetailsCard";
import type { AudioAnalysis } from "@/types/gait";

const mockAudio: AudioAnalysis = {
  detectedBPM: 120,
  rhythmRegularity: 85,
  beatPattern: "1-2-3-4",
  audioGaitClassification: "tölt",
  audioConfidence: 90,
  weakBeatDetected: false,
};

describe("AudioDetailsCard", () => {
  it("renders audio metrics when mode is audio", () => {
    render(<AudioDetailsCard audioAnalysis={mockAudio} analysisMode="audio" />);
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("1-2-3-4")).toBeInTheDocument();
  });

  it("renders audio metrics when mode is both", () => {
    render(<AudioDetailsCard audioAnalysis={mockAudio} analysisMode="both" />);
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("returns null when mode is vision", () => {
    const { container } = render(<AudioDetailsCard audioAnalysis={mockAudio} analysisMode="vision" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when no audioAnalysis", () => {
    const { container } = render(<AudioDetailsCard analysisMode="audio" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows weak beat warning when detected", () => {
    render(<AudioDetailsCard audioAnalysis={{ ...mockAudio, weakBeatDetected: true, weakBeatDescription: "נקישה חלשה" }} analysisMode="audio" />);
    expect(screen.getByText("נקישה חלשה")).toBeInTheDocument();
  });
});
