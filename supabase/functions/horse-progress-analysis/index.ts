import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `אתה מאמן סוסים גייטד מומחה עם 20 שנות ניסיון ברכיבה, אימון ושיפוט תנועה (FEIF/FOSH).
אתה מקבל היסטוריית ניתוחי תנועה ומבנה גוף של סוס ספציפי. תפקידך:

1. **סיכום התקדמות** — ניתוח מגמת ציוני Overall Score, Symmetry, Confidence לאורך זמן
2. **ממצאים קינמטיים** — זיהוי נקודות חוזק ביומכניות (סימטריה, beat evenness, lateral sync)
3. **תעודת איכות** — הערכה כוללת של איכות הסוס בסקאלה 1-10 עם נימוקים
4. **המלצות אימון** — 3 המלצות ספציפיות מבוססות על הנתונים
5. **אבחון מגמות** — זיהוי שיפור/ירידה/יציבות בביצועים

כללים:
- כתוב בעברית
- היה מדויק — השתמש במספרים מהנתונים
- אם יש פחות מ-2 ניתוחים, ציין שצריך עוד נתונים אך עדיין ספק תובנות מה שיש
- השתמש בפורמט Markdown
- סיים ב-"סיכום למאמן" תמציתי של 2-3 משפטים`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { horseId } = await req.json();
    if (!horseId) {
      return new Response(JSON.stringify({ error: "horseId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch horse + all analyses
    const [horseRes, gaitRes, confRes] = await Promise.all([
      supabase.from("horses").select("*").eq("id", horseId).single(),
      supabase
        .from("gait_analyses")
        .select("created_at, gait_type, gait_type_hebrew, overall_score, symmetry_score, confidence, beat_pattern, lateral_sync_pct, lameness_risk, analysis_mode, human_validated, result_json")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: true }),
      supabase
        .from("conformation_records")
        .select("created_at, overall_balance, suitability_score, shoulder_angle, croup_slope, strengths, weaknesses, recommendation")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: true }),
    ]);

    if (horseRes.error || !horseRes.data) {
      return new Response(JSON.stringify({ error: "Horse not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const horse = horseRes.data;
    const gaits = gaitRes.data || [];
    const confs = confRes.data || [];

    // Build context for AI
    const context = `
## פרטי הסוס
- שם: ${horse.name}
- גזע: ${horse.breed_id || "לא ידוע"}
- גנוטיפ DMRT3: ${horse.dmrt3_genotype || "לא ידוע"}
- גובה: ${horse.height_cm ? horse.height_cm + " ס\"מ" : "לא ידוע"}
- שנת לידה: ${horse.birth_year || "לא ידוע"}
- מין: ${horse.sex || "לא ידוע"}
- אב: ${horse.sire_name || "לא ידוע"} (DMRT3: ${horse.sire_dmrt3 || "?"})
- אם: ${horse.dam_name || "לא ידוע"} (DMRT3: ${horse.dam_dmrt3 || "?"})

## ניתוחי תנועה (${gaits.length} ניתוחים)
${gaits.map((g, i) => `### ניתוח ${i + 1} — ${g.created_at}
- סוג צעד: ${g.gait_type_hebrew || g.gait_type || "N/A"}
- ציון כולל: ${g.overall_score ?? "N/A"}/100
- סימטריה: ${g.symmetry_score ?? "N/A"}/100
- ביטחון: ${g.confidence ?? "N/A"}
- סנכרון צדדי: ${g.lateral_sync_pct ?? "N/A"}%
- תבנית פעימות: ${g.beat_pattern || "N/A"}
- סיכון צליעה: ${g.lameness_risk || "N/A"}
- מאומת: ${g.human_validated ? "כן" : "לא"}
`).join("\n")}

## ניתוחי מבנה גוף (${confs.length} ניתוחים)
${confs.map((c, i) => `### מבנה ${i + 1} — ${c.created_at}
- איזון כללי: ${c.overall_balance ?? "N/A"}/100
- התאמה: ${c.suitability_score ?? "N/A"}/100
- זווית כתף: ${c.shoulder_angle ?? "N/A"}°
- שיפוע עכוז: ${c.croup_slope ?? "N/A"}°
- חוזקות: ${(c.strengths as string[] || []).join(", ") || "N/A"}
- חולשות: ${(c.weaknesses as string[] || []).join(", ") || "N/A"}
`).join("\n")}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `נתח את ההתקדמות והאיכות של הסוס הבא:\n\n${context}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit — נסה שוב בעוד דקה" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נדרש תשלום — הוסף קרדיט" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("horse-progress error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
