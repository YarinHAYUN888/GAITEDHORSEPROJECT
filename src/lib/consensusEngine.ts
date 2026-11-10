// Weighted consensus computation for ground truth labels

import type { LabelVote, ConsensusResult } from "@/types/pipeline";

const ROLE_WEIGHTS: Record<string, number> = {
  user: 1,
  coach: 2,
  admin: 3,
};

const AGREEMENT_THRESHOLD = 0.7;

/**
 * Compute weighted consensus from a set of label votes.
 * Returns stable=true when agreement >= 0.7.
 */
export function computeConsensus(
  analysisId: string,
  votes: LabelVote[],
): ConsensusResult {
  if (votes.length === 0) {
    return {
      analysisId,
      finalLabel: "unknown",
      method: "weighted_vote",
      agreement: 0,
      labelStats: {},
      stable: false,
    };
  }

  // Check for expert override (admin vote with confidence 5)
  const expertOverride = votes.find(
    (v) => v.annotatorRole === "admin" && v.confidence >= 5,
  );
  if (expertOverride) {
    const labelStats: Record<string, number> = {};
    for (const v of votes) {
      labelStats[v.label] = (labelStats[v.label] || 0) + 1;
    }
    return {
      analysisId,
      finalLabel: expertOverride.label,
      method: "expert_override",
      agreement: 1,
      labelStats,
      stable: true,
    };
  }

  // Weighted vote aggregation
  const weightedTotals: Record<string, number> = {};
  let totalWeight = 0;

  for (const vote of votes) {
    const weight = ROLE_WEIGHTS[vote.annotatorRole] ?? 1;
    weightedTotals[vote.label] = (weightedTotals[vote.label] || 0) + weight;
    totalWeight += weight;
  }

  // Find winner
  let winner = "unknown";
  let maxWeight = 0;
  for (const [label, weight] of Object.entries(weightedTotals)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      winner = label;
    }
  }

  const agreement = totalWeight > 0 ? maxWeight / totalWeight : 0;

  // Label stats (unweighted counts)
  const labelStats: Record<string, number> = {};
  for (const v of votes) {
    labelStats[v.label] = (labelStats[v.label] || 0) + 1;
  }

  return {
    analysisId,
    finalLabel: winner,
    method: "weighted_vote",
    agreement: Math.round(agreement * 100) / 100,
    labelStats,
    stable: agreement >= AGREEMENT_THRESHOLD,
  };
}
