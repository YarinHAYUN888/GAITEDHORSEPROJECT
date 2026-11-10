import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SAFE_FALLBACK = {
  peakHorses: [],
  decliningHorses: [],
  overtrainedHorses: [],
  recommendations: ["לא ניתן לטעון תובנות כרגע. נסה שוב מאוחר יותר."],
  summary: "שגיאה בטעינת ניתוח AI. נסה שנית.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { horses, alerts, trainingCount } = await req.json();

    const prompt = `אתה מומחה לסוסי צעד (gaited horses) וניהול אורוות. קיבלת נתונים על אורווה שלמה.

נתוני סוסים:
${JSON.stringify(horses, null, 2)}

התראות קיימות:
${JSON.stringify(alerts, null, 2)}

אימונים השבוע: ${trainingCount}

נתח את המצב הכולל של האורווה והחזר JSON בלבד בפורמט הבא:
{
  "peakHorses": ["שמות סוסים בשיא ביצועים"],
  "decliningHorses": ["שמות סוסים בנסיגה"],
  "overtrainedHorses": ["שמות סוסים עם עומס יתר"],
  "recommendations": ["המלצה 1", "המלצה 2", "המלצה 3"],
  "summary": "סיכום קצר של מצב האורווה ב-2-3 משפטים"
}

התייחס לגנוטיפ DMRT3, מגמות ביצועים, סימטריה, סיכוני צליעה, ועומסי אימון. החזר JSON תקין בלבד ללא עטיפה.`;

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
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "אתה מומחה לסוסי צעד וניהול אורוות. החזר JSON בלבד." },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof DOMException && e.name === "AbortError") {
        console.error("AI gateway timeout after 30s");
        return new Response(JSON.stringify({ ...SAFE_FALLBACK, summary: "הבקשה ל-AI חרגה מזמן ההמתנה (30 שניות). נסה שנית." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "חריגה ממגבלת בקשות, נסו שוב בעוד דקה." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נדרש תשלום — הוסיפו קרדיטים." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ ...SAFE_FALLBACK, summary: "AI החזיר תשובה לא תקינה. נסה שנית." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stable-analytics error:", error);
    return new Response(JSON.stringify(SAFE_FALLBACK), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
