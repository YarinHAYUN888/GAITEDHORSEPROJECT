import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analysisId, horseId } = await req.json();
    const svc = createClient(supabaseUrl, supabaseKey);

    // Fetch analysis
    const { data: analysis } = await svc.from("gait_analyses")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (!analysis) throw new Error("Analysis not found");

    // Fetch horse
    let horse = null;
    if (horseId) {
      const { data } = await svc.from("horses").select("*").eq("id", horseId).single();
      horse = data;
    }

    // Fetch recent analyses for trend
    let recentAnalyses: any[] = [];
    if (horseId) {
      const { data } = await svc.from("gait_analyses")
        .select("created_at, gait_type, overall_score, symmetry_score, lameness_risk")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: false })
        .limit(10);
      recentAnalyses = data || [];
    }

    const resultJson = analysis.result_json as any;

    const prompt = `Generate a professional veterinary locomotion report in Hebrew based on the following data.

## Horse Details
Name: ${horse?.name || analysis.horse_name || "Unknown"}
Breed: ${horse?.breed_id || analysis.breed_id || "Unknown"}
DMRT3: ${horse?.dmrt3_genotype || analysis.dmrt3_genotype || "Unknown"}
Height: ${horse?.height_cm || "?"}cm

## Current Analysis (${analysis.created_at?.slice(0, 10)})
Gait Type: ${analysis.gait_type || "?"}
Overall Score: ${analysis.overall_score ?? "?"}
Symmetry Score: ${analysis.symmetry_score ?? "?"}
Confidence: ${analysis.confidence ?? "?"}
Lameness Risk: ${analysis.lameness_risk || "None"}
Beat Pattern: ${analysis.beat_pattern || "?"}
Lateral Sync: ${analysis.lateral_sync_pct ?? "?"}%

${resultJson?.biomechanics ? `## Biomechanics
Stride Duration: ${resultJson.biomechanics.meanStrideDuration ?? "?"}s
Duty Factor: ${resultJson.biomechanics.meanDutyFactor ?? "?"}
Stance/Swing Ratio: ${resultJson.biomechanics.stanceSwingRatio ?? "?"}` : ""}

${resultJson?.strideAnalysis ? `## Stride Analysis
Stride Count: ${resultJson.strideAnalysis.strideCount ?? "?"}
Mean Duration: ${resultJson.strideAnalysis.meanDuration ?? "?"}s
CV: ${resultJson.strideAnalysis.durationCV ?? "?"}` : ""}

${recentAnalyses.length > 1 ? `## Historical Trend (last ${recentAnalyses.length} analyses)
${recentAnalyses.map(a => `- ${a.created_at?.slice(0, 10)}: ${a.gait_type} | score=${a.overall_score} | sym=${a.symmetry_score} | lameness=${a.lameness_risk || "none"}`).join("\n")}` : ""}

Generate a structured clinical report with:
1. **כותרת** — "דוח לוקומוציה וטרינרי"
2. **סיכום מנהלי** — 2-3 משפטים
3. **ממצאים עיקריים** — bullet points
4. **ניתוח ביומכני** — based on metrics
5. **מגמות** — if historical data exists
6. **סיכום סיכונים** — AAEP lameness scale reference
7. **המלצות** — actionable clinical recommendations
8. **הערות** — disclaimers about AI analysis limitations`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a veterinary locomotion specialist. Write clinical reports in Hebrew. Use proper medical terminology. Always note that this is AI-assisted analysis and does not replace clinical examination." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const report = result.choices?.[0]?.message?.content || "שגיאה ביצירת הדוח";

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vet-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
