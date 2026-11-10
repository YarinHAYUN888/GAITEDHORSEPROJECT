import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `אתה מאמן סוסי צעד AI מומחה עם 30+ שנות ניסיון. אתה מתכנן תוכניות אימון אישיות מבוססות דאטה.

קיבלת נתוני ניתוחי תנועה אחרונים ויומני אימון של סוס ספציפי. על בסיס הנתונים:

1. **זהה נקודות תורפה**: מפרקים עם סטייה, אי-סימטריה, בעיות קצב, suspension ratio חריג.
2. **זהה נקודות חוזק**: מה הסוס עושה טוב — שמור עליהם.
3. **בנה תוכנית אימון 14 יום**: 
   - כל יום: סוג עבודה, תרגילים ספציפיים, משך, עוצמה
   - יום מנוחה אחד בשבוע
   - תרגילים ממוקדי בעיה (למשל: עבודה על שיפועים לחיזוק אחוריות, אינטרוולים למהירות)
4. **אבני דרך**: מתי לצפות לשיפור ומה למדוד
5. **התראות**: מה לא לעשות, מתי לעצור, סימני מצוקה

כתוב בעברית, בסגנון מקצועי. השתמש ב-Markdown (כותרות, רשימות, טבלאות).
החזר את התשובה כ-Markdown בלבד.`;

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

    const { horseId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Use user's JWT instead of SERVICE_ROLE_KEY — RLS ensures data isolation
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch horse data
    const { data: horse, error: horseErr } = await supabase
      .from("horses")
      .select("*")
      .eq("id", horseId)
      .single();

    if (horseErr || !horse) {
      return new Response(JSON.stringify({ error: "הסוס לא נמצא" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent gait analyses (last 10)
    const { data: analyses } = await supabase
      .from("gait_analyses")
      .select("*")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent training logs (last 20)
    const { data: trainingLogs } = await supabase
      .from("training_logs")
      .select("*")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch recent conformation records
    const { data: conformations } = await supabase
      .from("conformation_records")
      .select("*")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: false })
      .limit(3);

    // Build context
    let context = `=== פרופיל הסוס ===
שם: ${horse.name}
${horse.breed_id ? `גזע: ${horse.breed_id}` : ""}
${horse.dmrt3_genotype ? `DMRT3: ${horse.dmrt3_genotype}` : ""}
${horse.height_cm ? `גובה: ${horse.height_cm} ס"מ` : ""}
${horse.birth_year ? `שנת לידה: ${horse.birth_year}` : ""}
${horse.sex ? `מין: ${horse.sex}` : ""}
${horse.notes ? `הערות: ${horse.notes}` : ""}`;

    if (analyses && analyses.length > 0) {
      context += `\n\n=== ${analyses.length} ניתוחי תנועה אחרונים ===\n`;
      for (const a of analyses) {
        context += `\n--- ניתוח מ-${a.created_at} ---
סוג צעד: ${a.gait_type || "N/A"} (${a.gait_type_hebrew || ""})
ציון כולל: ${a.overall_score || "N/A"}
ביטחון: ${a.confidence || "N/A"}%
סימטריה: ${a.symmetry_score || "N/A"}
סנכרון לטרלי: ${a.lateral_sync_pct || "N/A"}%
צעד מלוכלך: ${a.is_dirty ? "כן" : "לא"}
BPM אודיו: ${a.audio_bpm || "N/A"}
סדירות: ${a.audio_regularity || "N/A"}%
סיכון צליעה: ${a.lameness_risk || "N/A"}
${a.result_json ? `נתוני ניתוח מלאים: ${JSON.stringify(a.result_json).substring(0, 2000)}` : ""}`;
      }
    }

    if (trainingLogs && trainingLogs.length > 0) {
      context += `\n\n=== ${trainingLogs.length} יומני אימון אחרונים ===\n`;
      for (const t of trainingLogs) {
        context += `${t.date}: ${t.type} — ${t.description || ""} (${t.duration_minutes || "?"} דקות)${t.notes ? ` | הערות: ${t.notes}` : ""}${t.ai_recommendations ? ` | המלצות AI: ${t.ai_recommendations}` : ""}\n`;
      }
    }

    if (conformations && conformations.length > 0) {
      context += `\n\n=== ניתוח מבנה גוף אחרון ===\n`;
      const c = conformations[0];
      context += `איזון כללי: ${c.overall_balance || "N/A"}/100
זווית כתף: ${c.shoulder_angle || "N/A"}°
שיפוע קרופ: ${c.croup_slope || "N/A"}°
חוזקות: ${(c.strengths || []).join(", ")}
חולשות: ${(c.weaknesses || []).join(", ")}
אזורי סיכון פציעה: ${(c.injury_risk_areas || []).join(", ")}`;
    }

    context += `\n\nאנא צור תוכנית אימון אישית של 14 יום, מותאמת לנתונים אלו. 
התמקד בחיזוק נקודות התורפה שזוהו, שמירה על נקודות החוזק, ומניעת פציעות.
אם יש מגמה שלילית (ירידה בציון, עלייה באסימטריה) — ציין זאת במפורש.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: context },
          ],
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof DOMException && e.name === "AbortError") {
        return new Response(JSON.stringify({ error: "הבקשה חרגה מזמן ההמתנה. נסו שוב." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "חריגה ממגבלת בקשות. נסו שוב בעוד דקה." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "נדרש תשלום — הוסיפו קרדיטים." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "שגיאה בשירות AI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const plan = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ plan, horseName: horse.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predictive-training error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
