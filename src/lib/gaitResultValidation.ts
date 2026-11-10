import { z } from "zod";
import type { GaitAnalysisResult } from "@/types/gait";

// Null means unavailable, never zero. Reject corrupted required values rather than invent scores.
const score = z.number().finite().min(0).max(100).nullable();
const measurement = z.number().finite().nullable();
const record = z.object({}).passthrough();
const schema = z.object({
  gaitType: z.string().trim().min(1),
  confidence: score,
  overallScore: score,
  lateralSync: record.extend({ percentage: score }),
  symmetry: record.extend({ score, leftRightDifference: measurement, lamenessRisk: z.string().nullable() }),
  extension: record.extend({ frontLegs: measurement, hindLegs: measurement, quality: z.string().nullable() }),
  keypoints: record.extend({ detected: z.boolean() }),
  beatTracker: record.extend({
    impactTimes: z.array(z.object({ leg: z.string(), frameIndex: z.number().finite(), phase: z.string() }).passthrough()),
    offsetPercentage: score,
    isDirty: z.boolean(),
  }),
}).passthrough();

export function isGaitResultValid(value: unknown): value is GaitAnalysisResult {
  return schema.safeParse(value).success;
}

export function requireGaitResult(value: unknown): GaitAnalysisResult {
  if (!isGaitResultValid(value)) throw new Error("Analysis response is incomplete or invalid. Please try another side-view video. / תשובת הניתוח חסרה או לא תקינה. נסו סרטון נוסף מהצד.");
  return value;
}