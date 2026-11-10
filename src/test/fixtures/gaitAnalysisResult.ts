import type { GaitAnalysisResult } from "@/types/gait";

const baseResult: GaitAnalysisResult = {
  gaitType: "tölt",
  gaitTypeHebrew: "טולט",
  confidence: 85,
  beatPattern: "1-2-3-4",
  lateralSync: { percentage: 92, description: "סינכרון לטרלי טוב" },
  symmetry: {
    score: 90,
    leftRightDifference: 3,
    lamenessRisk: "low",
    lamenessDescription: "ללא חשד לצליעה",
  },
  extension: {
    frontLegs: 75,
    hindLegs: 70,
    quality: "good",
    description: "הרחבה טובה",
  },
  keypoints: { detected: true },
  beatTracker: {
    impactTimes: [],
    offsetPercentage: 2,
    isDirty: false,
    dirtyDescription: "",
  },
  overallScore: 82,
  trainingRecommendations: ["תרגול קצב"],
  summary: "ניתוח כללי",
};

export const mockHealthyHorseResult: GaitAnalysisResult = {
  ...baseResult,
  overallScore: 88,
  confidence: 92,
  symmetry: { score: 95, leftRightDifference: 1, lamenessRisk: "low", lamenessDescription: "ללא חשד" },
  lateralSync: { percentage: 96, description: "מצוין" },
};

export const mockLameHorseResult: GaitAnalysisResult = {
  ...baseResult,
  overallScore: 55,
  confidence: 78,
  symmetry: { score: 62, leftRightDifference: 18, lamenessRisk: "high", lamenessDescription: "חשד לצליעה ברגל קדמית ימין" },
  lateralSync: { percentage: 74, description: "סינכרון נמוך" },
};

export const mockToltResult: GaitAnalysisResult = {
  ...baseResult,
  gaitType: "tölt",
  gaitTypeHebrew: "טולט",
  overallScore: 90,
  confidence: 95,
  lateralSync: { percentage: 98, description: "סינכרון מצוין" },
  symmetry: { score: 96, leftRightDifference: 1, lamenessRisk: "low", lamenessDescription: "" },
};

export const mockPaceResult: GaitAnalysisResult = {
  ...baseResult,
  gaitType: "pace",
  gaitTypeHebrew: "פייס",
  beatPattern: "1-2",
  overallScore: 85,
  confidence: 88,
  lateralSync: { percentage: 97, description: "סינכרון לטרלי גבוה" },
};

export const mockMinimalResult: GaitAnalysisResult = {
  ...baseResult,
  overallScore: 70,
  confidence: 60,
  keypoints: { detected: false },
  trainingRecommendations: [],
  summary: "",
};
