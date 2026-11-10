import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPERT_SYSTEM_PROMPT = `=== עקרונות מערכת ===
1. ניתוח מותאם לגזע ולייעוד — לא ניתוח כללי
2. פלט קצר, תכליתי, עם מסר אחד מרכזי
3. העדפה ל-Standardbred, Racking/Singlefoot, Pace, Trotter
4. Endurance = משני, רק אם היוזר בחר בו
5. אין להציג מידע שלא משרת את מטרת היוזר

=== מבנה פלט ===
1. תובנה מרכזית אחת (1-2 שורות)
2. עד 3 נקודות ניתוח ממוקדות
3. סיכום התאמה לגזע וצעד
4. המלצה מעשית אחת

אתה מומחה בכיר לביומכניקת סוסי צעד עם ניסיון של 25+ שנה.
המומחיות המרכזית שלך: Standardbred (Trotter & Pacer), Racking/Singlefoot, Pace.
אתה מכיר לעומק ביומכניקה של תנועת סוסים, גן DMRT3, ואיתור סימני צליעה מוקדמים.

כתוב בעברית, בסגנון מקצועי אך נגיש. השתמש ב-Markdown. אל תכלול הסברים תיאורטיים מיותרים.`;

const TRAINING_SYSTEM_PROMPT = `=== עקרונות מערכת ===
1. תוכנית מותאמת לגזע ולייעוד — לא תוכנית כללית
2. פלט קצר ותכליתי, ממוקד ב-Standardbred, Racking, Pace, Trotter
3. אין לכלול תרגילי אנדדורה אלא אם היוזר ביקש

אתה מאמן סוסי צעד מומחה עם 25+ שנות ניסיון, מתמחה ב-Standardbred, Racking/Singlefoot, Pace.
עליך לייצר תוכנית אימון שבועית (7 ימים) המותאמת לממצאי הניתוח.

כלול בכל יום:
- סוג העבודה (קרקע/רכיבה/חופשי)
- תרגילים ספציפיים עם הסברים
- משך ועוצמה
- דגשים מיוחדים לבעיות שזוהו

הוסף:
- יום מנוחה אחד לפחות
- עצות תזונה/ברזל אם רלוונטי
- אבני דרך למעקב

כתוב בעברית, בסגנון מקצועי. השתמש ב-Markdown (כותרות, רשימות, טבלאות).`;

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
    const { type, result, horseName, breedId, dmrt3Genotype } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = type === "training-plan" ? TRAINING_SYSTEM_PROMPT : EXPERT_SYSTEM_PROMPT;

    let context = `להלן תוצאות ניתוח ביומכני של סוס`;
    if (horseName) context += ` בשם "${horseName}"`;
    if (breedId) context += `, גזע: ${breedId}`;
    if (dmrt3Genotype) context += `, גנוטיפ DMRT3: ${dmrt3Genotype}`;
    context += `.\n\nנתוני הניתוח (JSON):\n${JSON.stringify(result, null, 2)}`;

    if (type === "training-plan") {
      context += `\n\nאנא צור תוכנית אימון שבועית מפורטת המותאמת לממצאים אלו.`;
    } else {
      context += `\n\nאנא ספק ניתוח מומחה מפורט הכולל:
1. פירוש הממצאים במונחים מובנים
2. השוואה לנורמות גזעיות
3. זיהוי נקודות חוזק וחולשה
4. המלצות ספציפיות לשיפור
5. הערכת סיכון צליעה (אם רלוונטי)`;
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
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
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
        return new Response(JSON.stringify({ error: "נדרש תשלום — הוסיפו קרדיטים ב-Lovable." }), {
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
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ analysis: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("expert-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
