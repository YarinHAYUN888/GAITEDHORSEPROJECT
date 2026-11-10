import { supabase } from "@/integrations/supabase/client";
import type { GaitAnalysisResult } from "@/types/gait";

export async function fetchExpertAnalysis(result: GaitAnalysisResult, horseName?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("expert-analysis", {
    body: { type: "expert", result, horseName },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.analysis || "";
}

export async function fetchTrainingPlan(result: GaitAnalysisResult, horseName?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("expert-analysis", {
    body: { type: "training-plan", result, horseName },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.analysis || "";
}

export async function generateReport(result: GaitAnalysisResult, horseName?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-report", {
    body: { result, horseName },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.report || "";
}
