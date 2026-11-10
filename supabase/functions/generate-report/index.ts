import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `=== עקרונות מערכת ===
1. דוח מותאם לגזע ולייעוד — לא דוח כללי
2. פלט קצר, תכליתי, עם מסר אחד מרכזי
3. העדפה ל-Standardbred, Racking/Singlefoot, Pace, Trotter
4. Endurance = משני, רק אם היוזר בחר בו
5. אין להציג מידע שלא משרת את מטרת היוזר

אתה מערכת הפקת דוחות מקצועיים לניתוח תנועת סוסי צעד, מתמחה ב-Standardbred, Racking, Pace ו-Trotter.

צור דוח מקצועי ומובנה בעברית הכולל:

1. **כותרת הדוח** עם שם הסוס ותאריך
2. **תובנה מרכזית** — 1-2 משפטים עם המסר העיקרי
3. **טבלת מדדים** — רק המדדים הרלוונטיים לגזע ולמטרה
4. **עד 3 נקודות ניתוח ממוקדות**
5. **סיכום התאמה לגזע וצעד**
6. **המלצה מעשית אחת**

הדוח צריך להיות מעוצב ב-Markdown נקי, מוכן להדפסה.
הוסף קו מפריד (---) בין סעיפים.
אל תכלול הסברים תיאורטיים מיותרים.`;

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
    const { result, horseName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `הפק דוח מקצועי עבור${horseName ? ` הסוס "${horseName}"` : " סוס"}.\n\nנתוני ניתוח:\n${JSON.stringify(result, null, 2)}\n\nתאריך: ${new Date().toLocaleDateString("he-IL")}`;

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
          { role: "user", content: prompt },
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

    return new Response(JSON.stringify({ report: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
