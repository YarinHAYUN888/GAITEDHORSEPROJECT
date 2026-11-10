import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `אתה מומחה לשושלאות וגנטיקה של סוסי צעד (gaited horses).

כאשר מקבלים תעודת יוחסין או מידע על שושלת סוס, עליך:

1. **זיהוי גזעים** — זהה את הגזעים המעורבים בשושלת
2. **ניתוח קווי דם** — זהה קווי דם ידועים ומשמעותם
3. **הערכת DMRT3** — העריך סיכויים לנשיאת מוטציית DMRT3 על בסיס הגזעים והקווים
4. **חוזקות גנטיות** — מה צפוי מהשילוב הגנטי הזה
5. **חולשות פוטנציאליות** — בעיות גנטיות ידועות בגזעים/קווים אלו
6. **המלצות לזיווג** — אם רלוונטי, המלצות לשיפור הדור הבא
7. **פוטנציאל צעד** — הערכת סוג הצעד הצפוי על בסיס הגנטיקה

## ידע גזעי
- **Icelandic Horse**: קווי דם ידועים כמו Hrafn frá Holtsmúla, Orri frá Þúfu
- **Tennessee Walker**: קווי Midnight Sun, Merry Go Boy
- **Paso Fino**: קווי Dorado, Resorte, Dulce Sueño  
- **Missouri Fox Trotter**: קווי Merry Boy, Golden Governor
- **Mangalarga Marchador**: קווי Dorinah, Predileto

## הנחיות
- כתוב בעברית מקצועית ונגישה
- השתמש ב-Markdown (כותרות, רשימות, **הדגשות**, טבלאות)
- אם המידע חלקי, ציין מה חסר ותן הערכה על בסיס מה שזמין
- שלב חישובי הסתברות גנטית (Punnett squares) כאשר רלוונטי`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pedigreeText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
          { role: "user", content: `נתח את תעודת היוחסין הבאה:\n\n${pedigreeText}` },
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
    console.error("pedigree-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
