import { supabase } from "@/integrations/supabase/client";

export interface FeedbackInput {
  analysisId: string;
  feedbackType: "gait_correction" | "keypoint_correction" | "recommendation_rating" | "general";
  correctedGaitType?: string;
  keypointCorrections?: Record<string, [number, number]>;
  rating?: number;
  comment?: string;
  isExpert?: boolean;
}

export interface FeedbackRecord {
  id: string;
  analysis_id: string;
  user_id: string;
  feedback_type: string;
  corrected_gait_type: string | null;
  keypoint_corrections: Record<string, [number, number]> | null;
  rating: number | null;
  comment: string | null;
  is_expert: boolean;
  created_at: string;
}

export async function submitFeedback(input: FeedbackInput): Promise<{ feedbackId: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getAnalysisFeedback(analysisId: string): Promise<FeedbackRecord[]> {
  const { data, error } = await supabase
    .from("analysis_feedback")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as FeedbackRecord[]) ?? [];
}
