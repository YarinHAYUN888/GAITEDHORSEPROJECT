import { z } from "zod";

// ── Auth ──
export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Required").max(128),
});

export const signupSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(128),
  displayName: z.string().trim().max(100).optional(),
});

// ── Horse profile edit ──
export const horseProfileSchema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  breed_id: z.string().max(100).nullable().optional(),
  dmrt3_genotype: z.string().max(20).nullable().optional(),
  birth_year: z.coerce.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  sex: z.string().max(20).nullable().optional(),
  height_cm: z.coerce.number().int().min(50).max(250).nullable().optional(),
  sire_name: z.string().trim().max(100).nullable().optional(),
  dam_name: z.string().trim().max(100).nullable().optional(),
  sire_dmrt3: z.string().max(20).nullable().optional(),
  dam_dmrt3: z.string().max(20).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ── Upload flow context ──
export const uploadContextSchema = z.object({
  horseName: z.string().trim().max(100).optional(),
  breedId: z.string().max(100).optional(),
  dmrt3: z.string().max(20).optional(),
  horseHeight: z.string().regex(/^(\d{1,3})?$/, "Invalid height").optional(),
  notes: z.string().max(2000).optional(),
});

// ── Feedback panel ──
export const feedbackSchema = z.object({
  isGaitCorrect: z.boolean().nullable(),
  correctedGait: z.string().max(50).optional(),
  recommendationRating: z.number().int().min(0).max(5),
  comment: z.string().max(2000).optional(),
});

// ── Pre-analysis questionnaire ──
export const questionnaireSchema = z.object({
  primaryGoal: z.string().min(1, "Required").max(50),
  targetStyle: z.string().min(1, "Required").max(50),
  primaryUse: z.string().min(1, "Required").max(50),
  outputPreference: z.array(z.string().max(50)).min(1, "Select at least one"),
  additionalInfo: z.string().max(2000).optional(),
});

// ── Conformation analysis ──
export const conformationSchema = z.object({
  horseName: z.string().trim().max(100).optional(),
  breedId: z.string().max(100).optional(),
  dmrt3Genotype: z.string().max(20).optional(),
});

// ── Send report ──
export const sendReportSchema = z.object({
  recipientName: z.string().trim().max(100).optional(),
  recipientPhone: z.string().regex(/^\+?[\d\s-]{0,20}$/, "Invalid phone").optional(),
  recipientEmail: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  personalNote: z.string().max(1000).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type HorseProfileInput = z.infer<typeof horseProfileSchema>;
export type QuestionnaireInput = z.infer<typeof questionnaireSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type SendReportInput = z.infer<typeof sendReportSchema>;
