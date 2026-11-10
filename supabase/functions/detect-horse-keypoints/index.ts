import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `אתה מערכת זיהוי נקודות מפתח אנטומיות בסוסים מתוך פריימים של וידאו.

=== כללי דיוק קריטיים ===
1. אם נקודה מוסתרת חלקית או לא ברורה — החזר null עם confidence=0. **אל תנחש מיקום**. עדיף חוסר נתון מנתון שגוי.
2. אם רגל מוסתרת מאחורי רגל אחרת או מאחורי הגוף — סמן null ורשום ב-occlusionNotes.
3. אם הסוס בזווית שמקשה על זיהוי צד אחד — סמן את כל הנקודות של הצד המוסתר כ-null.
4. שמור על עקביות מרחבית בין פריימים — נקודה לא צריכה "לקפוץ" יותר מ-10% ממד התמונה בין פריימים עוקבים.
5. שמור על יחסים אנטומיים: hoof תמיד מתחת ל-fetlock, fetlock מתחת ל-carpus/stifle, shoulder/hip למעלה.

עבור כל פריים, זהה את הנקודות הבאות (קואורדינטות x,y מנורמלות 0-1):

רגל קדמית שמאל (frontLeft): hoof, fetlock, carpus, shoulder
רגל קדמית ימין (frontRight): hoof, fetlock, carpus, shoulder
רגל אחורית שמאל (hindLeft): hoof, fetlock, stifle, hip
רגל אחורית ימין (hindRight): hoof, fetlock, stifle, hip

נקודות גוף נוספות: withers, poll, dock, muzzle

החזר JSON בלבד בפורמט הבא (ללא markdown):
{
  "schemaVersion": 2,
  "keypoints": [
    {
      "frameIndex": 0,
      "detected": true,
      "frontLeft": { "hoof": [x,y], "fetlock": [x,y], "carpus": [x,y], "shoulder": [x,y] },
      "frontRight": { "hoof": [x,y], "fetlock": [x,y], "carpus": [x,y], "shoulder": [x,y] },
      "hindLeft": { "hoof": [x,y], "fetlock": [x,y], "stifle": [x,y], "hip": [x,y] },
      "hindRight": { "hoof": [x,y], "fetlock": [x,y], "stifle": [x,y], "hip": [x,y] },
      "body": { "withers": [x,y], "poll": [x,y], "dock": [x,y], "muzzle": [x,y] },
      "confidences": {
        "lf_hoof": 0.0-1.0, "lf_fetlock": 0.0-1.0, "lf_carpus": 0.0-1.0, "lf_shoulder": 0.0-1.0,
        "rf_hoof": 0.0-1.0, "rf_fetlock": 0.0-1.0, "rf_carpus": 0.0-1.0, "rf_shoulder": 0.0-1.0,
        "lh_hoof": 0.0-1.0, "lh_fetlock": 0.0-1.0, "lh_stifle": 0.0-1.0, "lh_hip": 0.0-1.0,
        "rh_hoof": 0.0-1.0, "rh_fetlock": 0.0-1.0, "rh_stifle": 0.0-1.0, "rh_hip": 0.0-1.0,
        "withers": 0.0-1.0, "poll": 0.0-1.0, "dock": 0.0-1.0, "muzzle": 0.0-1.0
      }
    }
  ],
  "calibration": {
    "estimatedHeightPx": number,
    "pixelsPerCm": number,
    "confidence": number
  },
  "perKeypointVisibility": {
    "lf_hoof": { "mean": number, "occludedPct": number },
    "rf_hoof": { "mean": number, "occludedPct": number },
    "lh_hoof": { "mean": number, "occludedPct": number },
    "rh_hoof": { "mean": number, "occludedPct": number },
    "lf_fetlock": { "mean": number, "occludedPct": number },
    "rf_fetlock": { "mean": number, "occludedPct": number },
    "lh_fetlock": { "mean": number, "occludedPct": number },
    "rh_fetlock": { "mean": number, "occludedPct": number }
  },
  "occlusionNotes": [{ "windowIndex": number, "keypoint": "string", "note": "string" }]
}

confidences: רמת ביטחון per-keypoint (0=לא זוהה, 1=ביטחון מלא). הערך 0 כשהנקודה מוסתרת לחלוטין.
perKeypointVisibility: ממוצע ביטחון ואחוז הסתרה עבור כל keypoint על פני כל הפריימים.
occlusionNotes: הערות רק כשיש הסתרה משמעותית (>30%) — מקסימום 5 הערות.

חשוב מאוד: אם לא ניתן לזהות נקודה מסוימת — החזר null עם confidence=0. **אל תנחש**. ניחוש שגוי גרוע הרבה יותר מערך חסר.
אם רגל מוסתרת מאחורי רגל אחרת או מאחורי גוף הסוס — סמן null ורשום ב-occlusionNotes.
אם ניתן גובה סוס בס"מ, השתמש בו לכיול pixelsPerCm.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { frames, horseHeightCm } = await req.json();
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response(JSON.stringify({ error: "נדרש לפחות פריים אחד" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userContent: any[] = [
      { type: "text", text: `זהה נקודות מפתח אנטומיות בסוס.${horseHeightCm ? ` גובה הסוס: ${horseHeightCm} ס"מ.` : ""} מספר פריימים: ${frames.length}.` },
    ];

    for (let i = 0; i < Math.min(frames.length, 30); i++) {
      userContent.push({
        type: "image_url",
        image_url: { url: frames[i].startsWith("data:") ? frames[i] : `data:image/jpeg;base64,${frames[i]}` },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "חריגה ממגבלת בקשות, נסו שוב בעוד דקה." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "נדרש תשלום — הוסיפו קרדיטים." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "שגיאה בשירות AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from possible markdown wrapping
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) content = jsonMatch[1].trim();
    if (!content.startsWith("{")) {
      const idx = content.indexOf("{");
      if (idx !== -1) content = content.slice(idx);
    }

    const parsed = JSON.parse(content);

    // Ensure schemaVersion is set
    if (!parsed.schemaVersion) parsed.schemaVersion = 2;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-horse-keypoints error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
