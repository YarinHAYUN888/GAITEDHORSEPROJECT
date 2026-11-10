import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { frames } = await req.json();
    if (!frames?.length) {
      return new Response(JSON.stringify({ error: "No frames provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send only 2-3 frames for quick triage
    const triageFrames = frames.slice(0, Math.min(3, frames.length));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a video quality triage system for equine gait analysis. Analyze the provided frames and determine if the video is suitable for biomechanical analysis.

Return a JSON object using the suggest_triage tool with these fields:
- suitable: boolean — is the video good enough for analysis?
- confidence: number 0-1 — how confident are you?
- issues: string[] — list of issues found (empty if suitable)
- suggestions: string[] — actionable suggestions to improve (in Hebrew)
- angleOk: boolean — is the camera angle approximately side-on (profile view)?
- horseDetected: boolean — is a horse clearly visible?
- movementDetected: boolean — is the horse in motion?
- lightingOk: boolean — is lighting adequate?
- stabilityOk: boolean — is the camera stable enough?`
          },
          {
            role: "user",
            content: triageFrames.map((f: string, i: number) => ({
              type: "image_url" as const,
              image_url: { url: f },
            })),
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_triage",
            description: "Return the triage assessment for the video",
            parameters: {
              type: "object",
              properties: {
                suitable: { type: "boolean" },
                confidence: { type: "number" },
                issues: { type: "array", items: { type: "string" } },
                suggestions: { type: "array", items: { type: "string" } },
                angleOk: { type: "boolean" },
                horseDetected: { type: "boolean" },
                movementDetected: { type: "boolean" },
                lightingOk: { type: "boolean" },
                stabilityOk: { type: "boolean" },
              },
              required: ["suitable", "confidence", "issues", "suggestions", "angleOk", "horseDetected", "movementDetected", "lightingOk", "stabilityOk"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_triage" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const triage = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(triage), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: assume suitable
    return new Response(JSON.stringify({
      suitable: true, confidence: 0.5, issues: [], suggestions: [],
      angleOk: true, horseDetected: true, movementDetected: true, lightingOk: true, stabilityOk: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-triage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
