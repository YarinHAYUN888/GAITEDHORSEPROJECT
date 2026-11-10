import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REASON_CODES = [
  "REJECT_BLUR",
  "REJECT_SHAKE",
  "REJECT_OCCLUSION",
  "REJECT_OUT_OF_FRAME",
  "REJECT_TURNING",
  "REJECT_SPEED_CHANGE",
] as const;

const SYSTEM_PROMPT = `You are a video quality analyst for horse gait analysis. You receive per-window quality metrics and must select the best windows for biomechanical analysis.

RULES:
1. Select up to targetK windows that are most suitable for gait analysis.
2. Enforce diversity: selected windows must have at least minDistanceWindows indices apart.
3. Reject windows with quality below minQuality.
4. If no window meets quality threshold, set abstain=true.
5. Use ONLY these reason codes for rejections: ${REASON_CODES.join(", ")}

RESPOND WITH STRICT JSON ONLY (no markdown):
{
  "selected": [{"index": number, "score": number, "reason": "brief explanation"}],
  "rejected": [{"index": number, "reasonCodes": ["REJECT_..."]}],
  "abstain": boolean,
  "abstainReason": "string or null",
  "needsVisual": boolean,
  "coverageHint": "spread" | "clustered"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, windows, thumbnails, config } = await req.json();

    if (!windows || !Array.isArray(windows) || windows.length === 0) {
      return new Response(JSON.stringify({ error: "windows array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = {
      targetK: config?.targetK ?? 3,
      windowSec: config?.windowSec ?? 3,
      overlap: config?.overlap ?? 0.5,
      minQuality: config?.minQuality ?? 0.4,
      minDistanceWindows: config?.minDistanceWindows ?? 1,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userContent: any[] = [
      {
        type: "text",
        text: `Select the best windows for horse gait analysis.

Config: targetK=${cfg.targetK}, minQuality=${cfg.minQuality}, minDistanceWindows=${cfg.minDistanceWindows}

Windows metrics:
${JSON.stringify(windows, null, 1)}

Mode: ${mode || "metrics_only"}`,
      },
    ];

    // Add thumbnails if provided in metrics_plus_thumbnails mode
    if (mode === "metrics_plus_thumbnails" && thumbnails?.length) {
      for (let i = 0; i < Math.min(thumbnails.length, 10); i++) {
        userContent.push({
          type: "image_url",
          image_url: {
            url: thumbnails[i].startsWith("data:")
              ? thumbnails[i]
              : `data:image/jpeg;base64,${thumbnails[i]}`,
          },
        });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
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

    // Extract JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) content = jsonMatch[1].trim();
    if (!content.startsWith("{")) {
      const idx = content.indexOf("{");
      if (idx !== -1) content = content.slice(idx);
    }

    const parsed = JSON.parse(content);

    // Validate reason codes — strip unknown ones
    if (parsed.rejected) {
      for (const r of parsed.rejected) {
        if (r.reasonCodes) {
          r.reasonCodes = r.reasonCodes.filter((c: string) => REASON_CODES.includes(c as any));
        }
      }
    }

    // Enforce diversity constraint server-side
    if (parsed.selected && parsed.selected.length > 1) {
      const filtered: typeof parsed.selected = [parsed.selected[0]];
      for (let i = 1; i < parsed.selected.length; i++) {
        const candidate = parsed.selected[i];
        const tooClose = filtered.some(
          (s: any) => Math.abs(s.index - candidate.index) < cfg.minDistanceWindows
        );
        if (!tooClose) filtered.push(candidate);
      }
      parsed.selected = filtered.slice(0, cfg.targetK);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("select-analysis-windows error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
