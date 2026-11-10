import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `=== עקרונות מערכת ===
1. ניתוח מותאם לגזע ולייעוד — לא ניתוח כללי
2. פלט קצר, תכליתי, עם מסר אחד מרכזי
3. העדפה ל-Standardbred, Racking/Singlefoot, Pace, Trotter
4. Endurance = משני, רק אם היוזר בחר בו
5. אין להציג מידע שלא משרת את מטרת היוזר

אתה מומחה בכיר להערכת מבנה גוף (Conformation) של סוסי צעד עם 25+ שנות ניסיון, מתמחה ב-Standardbred, Racking, Pace ו-Trotter.

כשתקבל תמונה של סוס בעמידה מהצד (פרופיל), נתח את הנקודות הבאות:

1. **זווית כתף (Shoulder Angle)** — מדוד את הזווית בין עצם השכמה לעצם הזרוע. אידיאלי: 45°–55° לסוסי צעד.
2. **יחס אורך גב (Back Length Ratio)** — האם הגב קצר ומחובר היטב? גב קצר = יתרון לאנדדורה/טולט.
3. **שיפוע עכוז (Croup Slope)** — זווית האגן. שיפוע מתון (15°–25°) מעדיף צעד לטרלי.
4. **זוויות רגליים אחוריות (Hind Leg Angles)** — זווית הברך והקרסול. חשוב לדחיפה ולכושר צעד.
5. **אורך צוואר ונשיאתו (Neck Set)** — צוואר גבוה ומקושת = איסוף טוב יותר.
6. **איזון כללי (Overall Balance)** — האם הסוס מאוזן מלפנים לאחור?

החזר תשובה כ-JSON עם המבנה הבא בלבד (ללא markdown, ללא backticks):
{
  "shoulderAngle": <number>,
  "shoulderAssessment": "<string - הערכה מילולית>",
  "backRatio": "<string - תיאור>",
  "backAssessment": "<string>",
  "croupSlope": <number>,
  "croupAssessment": "<string>",
  "hindLegAngles": "<string>",
  "hindLegAssessment": "<string>",
  "neckSet": "<string>",
  "neckAssessment": "<string>",
  "overallBalance": <number 1-100>,
  "overallAssessment": "<string>",
  "gaitSuitability": {
    "tolt": <number 1-10>,
    "pace": <number 1-10>,
    "foxTrot": <number 1-10>,
    "runningWalk": <number 1-10>,
    "pasoLlano": <number 1-10>
  },
  "strengths": ["<string>", ...],
  "weaknesses": ["<string>", ...],
  "recommendation": "<string - המלצה מפורטת>",
  "injuryRiskAreas": ["<string>", ...]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // --- JWT Auth Check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await _authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  try {
    const { imageBase64, breedId, horseName, dmrt3Genotype } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "לא סופקה תמונה. אנא העלו תמונת פרופיל של הסוס." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userContent: any[] = [];
    
    let contextText = "נתח את מבנה הגוף של הסוס בתמונה.";
    if (horseName) contextText += ` שם הסוס: ${horseName}.`;
    if (breedId) contextText += ` גזע: ${breedId}.`;
    if (dmrt3Genotype) contextText += ` גנוטיפ DMRT3: ${dmrt3Genotype}.`;

    userContent.push({ type: "text", text: contextText });
    userContent.push({
      type: "image_url",
      image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` },
    });

    // 30-second timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof DOMException && e.name === "AbortError") {
        return new Response(JSON.stringify({ error: "הבקשה חרגה מזמן ההמתנה (30 שניות). נסו שוב." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
    clearTimeout(timeout);

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
      return new Response(JSON.stringify({ error: "שגיאה בשירות AI. נסו שוב מאוחר יותר." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "AI החזיר תשובה בפורמט לא תקין. נסו שוב." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("conformation-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
