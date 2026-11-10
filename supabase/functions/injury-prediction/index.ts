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

    const { horseId } = await req.json();
    const svc = createClient(supabaseUrl, supabaseKey);

    // Get horse info
    const { data: horse } = await svc.from("horses").select("*").eq("id", horseId).single();

    // Get all analyses for this horse
    const { data: analyses } = await svc.from("gait_analyses")
      .select("created_at, gait_type, overall_score, symmetry_score, confidence, lameness_risk, beat_pattern, lateral_sync_pct, result_json")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (!analyses?.length || analyses.length < 2) {
      return new Response(JSON.stringify({
        prediction: null,
        message: "נדרשים לפחות 2 ניתוחים כדי לזהות מגמות",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get health records
    const { data: healthRecords } = await svc.from("health_records")
      .select("date, type, description")
      .eq("horse_id", horseId)
      .order("date", { ascending: false })
      .limit(10);

    // Build trend data for LLM
    const trendData = analyses.map(a => {
      const r = a.result_json as any;
      return {
        date: a.created_at?.slice(0, 10),
        gaitType: a.gait_type,
        score: a.overall_score,
        symmetry: a.symmetry_score,
        lamenessRisk: a.lameness_risk,
        lateralSync: a.lateral_sync_pct,
        biomech: r?.biomechanics ? {
          meanStrideDuration: r.biomechanics.meanStrideDuration,
          meanDutyFactor: r.biomechanics.meanDutyFactor,
          stanceSwingRatio: r.biomechanics.stanceSwingRatio,
        } : null,
      };
    });

    const prompt = `Analyze the following longitudinal data for horse "${horse?.name || "Unknown"}" (${horse?.breed_id || "unknown breed"}, DMRT3: ${horse?.dmrt3_genotype || "?"}) and predict injury risks.

## Gait Analysis Trend (${trendData.length} sessions)
${JSON.stringify(trendData, null, 2)}

${healthRecords?.length ? `## Health History\n${healthRecords.map(h => `- ${h.date}: ${h.type} — ${h.description}`).join("\n")}` : ""}

Based on:
1. Symmetry score trends (declining = red flag)
2. Lameness risk progression
3. Stride consistency changes
4. Lateral sync changes
5. Duty factor shifts

Provide your assessment using the predict_injury tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an equine sports medicine AI specialist. Analyze longitudinal biomechanical data to predict injury risks. Be specific but cautious — always note this is predictive and requires clinical validation." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "predict_injury",
            description: "Return injury prediction assessment",
            parameters: {
              type: "object",
              properties: {
                riskLevel: { type: "string", enum: ["low", "moderate", "high", "critical"] },
                riskScore: { type: "number", description: "0-100 risk score" },
                concerns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      area: { type: "string", description: "Affected area (e.g. left hind, back)" },
                      concern: { type: "string", description: "Description in Hebrew" },
                      trend: { type: "string", enum: ["improving", "stable", "worsening"] },
                      urgency: { type: "string", enum: ["monitor", "attention", "urgent"] },
                    },
                    required: ["area", "concern", "trend", "urgency"],
                  },
                },
                recommendations: { type: "array", items: { type: "string" }, description: "Recommendations in Hebrew" },
                summary: { type: "string", description: "Executive summary in Hebrew" },
                dataQuality: { type: "string", enum: ["insufficient", "fair", "good", "excellent"] },
              },
              required: ["riskLevel", "riskScore", "concerns", "recommendations", "summary", "dataQuality"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "predict_injury" } },
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
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const prediction = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ prediction, analysisCount: analyses.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ prediction: null, message: "לא ניתן לייצר תחזית" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("injury-prediction error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
