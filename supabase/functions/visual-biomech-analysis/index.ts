import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Visual Biomechanical Analysis
 * 
 * Based on research-backed equine biomechanics:
 * - Clayton et al. (2013): Joint angle norms & kinematic chains
 * - Hobbs et al. (2016): Ground reaction forces & limb loading
 * - Rhodin et al. (2018): Markerless motion analysis validation
 * - PFERD dataset (2024): Dense motion capture reference data
 * - AAEP lameness grading: Asymmetry & head-bob assessment
 * 
 * Uses Gemini Vision to analyze a video frame and produce
 * structured, research-grounded biomechanical annotations
 * that are understandable by horse owners (not just researchers).
 */

const SYSTEM_PROMPT = `You are a world-class equine biomechanics expert analyzing a single frame from a horse gait video.

RESEARCH BASIS:
- Clayton et al. (2013): Normal joint angle ranges — shoulder 110-130°, elbow 140-165°, carpus 170-180° at stance, fetlock 220-240° at stance
- Hobbs et al. (2016): Weight distribution should be ~60% front / 40% hind at walk; asymmetry >5% indicates potential lameness
- Rhodin et al. (2018): Head and pelvis vertical displacement symmetry is key lameness indicator
- AAEP Lameness Scale: Grade 0 (sound) to Grade 5 (non-weight-bearing)

ANALYZE THE IMAGE AND RETURN VALID JSON with this exact structure:
{
  "postureAssessment": {
    "headPosition": "elevated|neutral|low",
    "headPositionNote": "Hebrew description of what the head position means biomechanically",
    "neckAngle": "upright|normal|extended",
    "neckNote": "Hebrew note",
    "backline": "hollow|level|rounded",
    "backlineNote": "Hebrew note about topline engagement",
    "hindquarterEngagement": "poor|moderate|good|excellent",
    "hindquarterNote": "Hebrew note about impulsion and tracking up"
  },
  "limbAnalysis": {
    "frontLimbs": {
      "phase": "stance|swing|breakover",
      "alignment": "good|toeing_in|toeing_out|over_at_knee|back_at_knee",
      "alignmentNote": "Hebrew",
      "strideCharacter": "Hebrew description of front limb motion quality"
    },
    "hindLimbs": {
      "phase": "stance|swing|breakover",
      "alignment": "good|sickle_hocked|straight_behind|cow_hocked",
      "alignmentNote": "Hebrew",
      "strideCharacter": "Hebrew description of hind limb motion quality",
      "trackingUp": "under-tracking|tracking-up|over-tracking"
    }
  },
  "weightDistribution": {
    "frontHindRatio": "estimated front/hind ratio, e.g. 55/45",
    "lateralBalance": "even|left_heavy|right_heavy",
    "note": "Hebrew explanation of balance and loading"
  },
  "movementQuality": {
    "overallImpression": "poor|fair|moderate|good|excellent",
    "rhythm": "irregular|mostly_regular|regular",
    "suppleness": "stiff|moderate|supple",
    "impulsion": "lacking|adequate|good|strong",
    "summaryHe": "Hebrew 2-3 sentence summary of overall movement quality for the horse owner"
  },
  "clinicalFlags": [
    {
      "area": "string - body area",
      "concern": "string - Hebrew description of potential issue",
      "severity": "info|mild|moderate|severe",
      "recommendation": "string - Hebrew actionable recommendation"
    }
  ],
  "annotationRegions": [
    {
      "id": "string",
      "label": "Hebrew label for this annotation",
      "xPercent": 0.0,
      "yPercent": 0.0,
      "type": "joint|muscle_group|posture|force_line",
      "status": "normal|attention|concern",
      "detail": "Hebrew detail shown on tap/hover"
    }
  ],
  "researchNotes": "Hebrew paragraph explaining what research-backed standards were used in this analysis"
}

CRITICAL RULES:
1. ALL text fields must be in Hebrew
2. annotationRegions xPercent/yPercent are 0-1 coordinates on the image (0,0 = top-left)
3. Place 8-15 annotation points on key anatomical landmarks visible in the image
4. Be conservative with clinical flags — only flag what you can clearly see
5. If the image is unclear or not showing a horse, return a minimal response with a note
6. Focus on making insights ACTIONABLE for horse owners, not academic jargon`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { frame, gaitType, breedId, context } = await req.json();

    if (!frame) {
      return new Response(
        JSON.stringify({ error: "Missing frame data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context
    const contextParts: string[] = [];
    if (gaitType) contextParts.push(`סוג הצעד שזוהה: ${gaitType}`);
    if (breedId) contextParts.push(`גזע: ${breedId}`);
    if (context) contextParts.push(`הקשר נוסף: ${context}`);

    const userContent: any[] = [
      {
        type: "image_url",
        image_url: {
          url: frame.startsWith("data:") ? frame : `data:image/jpeg;base64,${frame}`,
        },
      },
      {
        type: "text",
        text: `נתח את הפריים הזה מסרטון תנועת סוס. ${contextParts.length > 0 ? contextParts.join(". ") + "." : ""} ספק ניתוח ביומכני מלא ומובנה.`,
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content ?? "";
    
    // Strip markdown fences
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Try to extract JSON object if surrounded by extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON object found in AI response:", content.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned non-JSON response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let jsonStr = jsonMatch[0];

    // Fix common LLM JSON issues:
    // 1. Trailing commas before } or ]
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
    // 2. Unescaped newlines inside string values
    jsonStr = jsonStr.replace(/(?<=:\s*"[^"]*)\n([^"]*")/g, "\\n$1");

    let analysis: unknown;
    try {
      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("JSON parse failed after cleanup:", (parseErr as Error).message, "content:", jsonStr.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response as JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        analysis,
        processing_time_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("visual-biomech-analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
