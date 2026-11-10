import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a gait classification consistency checker for horses. You receive ONLY numerical data (feature vectors and vote distributions) — NO images.

Your job: verify whether the proposed gait classification is consistent with the biomechanical evidence.

IMPORTANT:
- You are a GATING model only. You CANNOT replace the classification directly.
- If data is inconsistent, provide alternatives with scores and list contradictions.
- Be conservative: approve unless there is STRONG evidence of inconsistency.

Expected ranges per classification:
- diagonal (trot): meanDiagonalLag < 20ms, meanLateralLag > 60ms
- lateral (pace): meanLateralLag < 20ms, meanDiagonalLag > 60ms
- singlefoot: both lags > 30ms, latLag/diagLag ratio < 0.7, beatEvenness > 0.6
- four_beat (tölt): both lags > 30ms, ratio >= 0.7, beatEvenness > 0.7
- broken_pace: ratio < 0.7, beatEvenness < 0.6, pacer breed

RESPOND WITH STRICT JSON ONLY (no markdown):
{
  "approved": boolean,
  "confidenceAdjustment": number (multiplier 0.5..1.2),
  "alternatives": [{"classification": string, "score": number}],
  "reasonCodes": string[],
  "contradictions": [{"metric": string, "observed": number, "expectedRange": string}]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      classification,
      confidence,
      features,
      windowVoteBreakdown,
      qualityWindows,
      totalWindows,
      stdBeatEvenness,
      stdOrderConsistency,
    } = body;

    if (!classification || !features) {
      return new Response(JSON.stringify({ error: "classification and features are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Verify this gait classification:

Classification: ${classification}
Confidence: ${confidence}

Feature Vector:
${JSON.stringify(features, null, 2)}

Window Vote Breakdown: ${JSON.stringify(windowVoteBreakdown)}
Quality Windows: ${qualityWindows} / ${totalWindows}
Std Beat Evenness: ${stdBeatEvenness ?? "N/A"}
Std Order Consistency: ${stdOrderConsistency ?? "N/A"}

Is this classification consistent with the data?`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0,
        top_p: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) content = jsonMatch[1].trim();
    if (!content.startsWith("{")) {
      const idx = content.indexOf("{");
      if (idx !== -1) content = content.slice(idx);
    }

    const parsed = JSON.parse(content);

    // Clamp confidenceAdjustment to safe range
    if (typeof parsed.confidenceAdjustment === "number") {
      parsed.confidenceAdjustment = Math.max(0.5, Math.min(1.2, parsed.confidenceAdjustment));
    } else {
      parsed.confidenceAdjustment = 1.0;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-consistency-check error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
