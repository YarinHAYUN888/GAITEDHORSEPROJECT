// Condition detection and health screening types

export interface ConditionRiskScreening {
  conditionName: string;
  conditionNameEn: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  matchedSigns: string[];
  confidence: number;
}

export interface EvidenceItem {
  metric: string;
  value: number | string;
  unit?: string;
  threshold?: number | string;
  direction?: "high" | "low" | "unstable";
  windowIndex?: number;
}

export interface DetectConditionsResult {
  conditions: Array<{
    name: string;
    nameEn: string;
    risk: string;
    confidence: number;
    evidence: string[];
    recommendation: string;
    objectiveMetricsUsed?: string[];
    structuredEvidence?: EvidenceItem[];
  }>;
  alerts: Array<{ severity: string; message: string }>;
  overallHealthScore: number;
  riskScreening: { preComputedRisks: ConditionRiskScreening[]; matchedSignsCount: number };
  primaryConcern: string | null;
  immediateActions: string[];
  processing_time_ms: number;
  // v2 screening fields
  screeningOnly?: true;
  intendedUse?: "screening_support";
  notDiagnostic?: true;
  requiresVetReview?: boolean;
  objectiveMetricsUsed?: string[];
}
