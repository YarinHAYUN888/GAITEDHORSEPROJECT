import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REPORT_PROMPT = `אתה מערכת הפקת דוחות מקצועיים לניתוח תנועת סוסים.

צור דוח מקצועי ומפורט בעברית הכולל:

1. **כותרת** עם שם הסוס, תאריך וזמן
2. **סיכום מנהלים** — 3-4 משפטים תמציתיים
3. **טבלת מדדים** — כל מדד עם ערך, נורמה, וסטטוס (✅/⚠️/❌)
4. **ניתוח גייט מפורט** — סוג, דפוס, סנכרון, איכות
5. **ניתוח ביומכני** — זוויות מפרקים, suspension, overreach
6. **הערכת סיכונים בריאותיים** — עם רמת חומרה
7. **המלצות אימון** — 5 המלצות מעשיות
8. **גרף טקסטואלי** של ציוני הניתוח
9. **חתימה דיגיטלית** — "דוח זה הופק אוטומטית על ידי GaitIQ"

פורמט: Markdown נקי, מוכן להדפסה.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { analysisId, recipientEmail, format = "markdown" } = await req.json();
    if (!analysisId) {
      return new Response(JSON.stringify({ error: "נדרש מזהה ניתוח" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Use user's JWT instead of SERVICE_ROLE_KEY — RLS ensures data isolation
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch analysis data
    const { data: analysis, error: fetchError } = await supabase
      .from("gait_analyses")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (fetchError || !analysis) {
      return new Response(JSON.stringify({ error: "ניתוח לא נמצא" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `הפק דוח ${format === "html" ? "HTML" : "Markdown"} עבור${analysis.horse_name ? ` הסוס "${analysis.horse_name}"` : " סוס"}.

נתוני ניתוח:
${JSON.stringify(analysis.result_json, null, 2)}

מדדים נוספים:
- ציון כולל: ${analysis.overall_score}
- סוג גייט: ${analysis.gait_type_hebrew || analysis.gait_type}
- סנכרון לטרלי: ${analysis.lateral_sync_pct}%
- ציון סימטריה: ${analysis.symmetry_score}
- סיכון צליעה: ${analysis.lameness_risk}
- BPM אודיו: ${analysis.audio_bpm || "לא זמין"}

תאריך ניתוח: ${new Date(analysis.created_at).toLocaleDateString("he-IL")}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: REPORT_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "חריגה ממגבלת בקשות." }), {
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
    const report = data.choices?.[0]?.message?.content || "";

    // Update analysis record with report
    await supabase.from("gait_analyses").update({
      notes: report.slice(0, 5000),
    }).eq("id", analysisId);

    return new Response(JSON.stringify({
      report,
      reportId: analysisId,
      format,
      generatedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-analysis-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
