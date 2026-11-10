import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `אתה מומחה גנטיקה של סוסי צעד (gaited horses) עם ידע מעמיק ב:

## גן DMRT3 (Doublesex and Mab-3 Related Transcription factor 3)
- **CC (Wild type)**: צעד רגיל בלבד — טרוט וגאלופ. הסוס לא יכול לבצע צעדים נוספים.
- **CA (Heterozygous)**: יכולת חלקית לצעדים נוספים. חלק מהסוסים יציגו Tölt או Pace חלקי.
- **AA (Homozygous mutant)**: יכולת מלאה לצעדים נוספים — Tölt, Pace, Fox Trot, Running Walk וכו'. זו המוטציה "הרצויה" בגזעי צעד.

## גזעי צעד עיקריים
- **Icelandic Horse**: 5 צעדים (Walk, Trot, Canter, Tölt, Flying Pace). רוב הסוסים AA או CA.
- **Tennessee Walking Horse**: Running Walk ייחודי. רוב הסוסים AA.
- **Paso Fino**: Paso Llano, Paso Corto, Paso Largo. צעד טבעי מלידה.
- **Missouri Fox Trotter**: Fox Trot — שילוב Walk קדמי + Trot אחורי.
- **Mangalarga Marchador**: Marcha Batida (אלכסוני) ו-Marcha Picada (לטרלי).
- **American Saddlebred**: Slow Gait ו-Rack (5-gaited).
- **Standardbred**: Pace או Trot — תלוי בקו גנטי.

## ביומכניקה
- סינכרון לטרלי: מדד למידת ההתאמה בין רגליים באותו צד
- סימטריה: ההבדל בין צד ימין לשמאל — אי-סימטריה מעל 3° עשויה להעיד על בעיה
- Beat Pattern: 4-beat (Tölt/Walk), 2-beat (Trot/Pace), 3-beat (Canter)
- "צעד מלוכלך" (Dirty gait): סטייה מהדפוס האידיאלי

## הנחיות תשובה
- ענה בעברית, בסגנון מקצועי אך נגיש
- השתמש ב-Markdown לפורמוט (כותרות, רשימות, **הדגשות**)
- אם אינך בטוח, ציין זאת בכנות
- קשר תמיד לפרקטיקה — מה זה אומר עבור המאמן/בעלים
- אם שואלים על הסתברויות גנטיות, תן את החישוב המדויק (Punnett square)
- אם קיבלת הקשר (context) של סוס ספציפי מהמערכת, השתמש בו כדי לתת תשובות מותאמות אישית`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, horseContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context-enriched system messages
    const systemMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // If horse context is provided, inject it as a system message
    if (horseContext) {
      let contextStr = "\n\n## הקשר סוס מהמערכת:\n";
      if (horseContext.name) contextStr += `- **שם**: ${horseContext.name}\n`;
      if (horseContext.breed) contextStr += `- **גזע**: ${horseContext.breed}\n`;
      if (horseContext.dmrt3) contextStr += `- **גנוטיפ DMRT3**: ${horseContext.dmrt3}\n`;
      if (horseContext.latestGaitScore != null) contextStr += `- **ציון צעד אחרון**: ${horseContext.latestGaitScore}/100\n`;
      if (horseContext.latestSymmetry != null) contextStr += `- **סימטריה אחרונה**: ${horseContext.latestSymmetry}/100\n`;
      if (horseContext.isDirty) contextStr += `- **צעד מלוכלך**: כן\n`;
      if (horseContext.lamenessRisk) contextStr += `- **סיכון צליעה**: ${horseContext.lamenessRisk}\n`;
      if (horseContext.recentTrainings != null) contextStr += `- **אימונים ב-7 ימים אחרונים**: ${horseContext.recentTrainings}\n`;
      systemMessages.push({ role: "system", content: contextStr });
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
          ...systemMessages,
          ...messages,
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("genetics-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
