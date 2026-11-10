import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `אתה מומחה לביומכניקה של סוסי צעד. קיבלת נתוני אודיו שחולצו מסרטון אימון (BPM, סדירות, מספר פעימות, משרעות שיא).

נתח את הקצב וחזור JSON בלבד עם המבנה הבא:
{
  "rhythmScore": <number 0-100>,
  "gaitPattern": "<string - סוג הצעד שזוהה>",
  "gaitPatternHebrew": "<string - בעברית>",
  "beatType": "<string - 2-beat/3-beat/4-beat/irregular>",
  "idealBPM": <number - ה-BPM האידיאלי לצעד שזוהה>,
  "bpmDeviation": <number - סטייה מהאידיאל באחוזים>,
  "segments": [
    {
      "startBeat": <number>,
      "endBeat": <number>,
      "quality": "<good|warning|bad>",
      "note": "<string - הערה קצרה בעברית>"
    }
  ],
  "syncIssues": [
    {
      "atBeat": <number>,
      "severity": "<mild|moderate|severe>",
      "description": "<string - בעברית>"
    }
  ],
  "recommendations": ["<string>", ...],
  "summary": "<string - סיכום 2-3 משפטים בעברית>"
}

קח בחשבון:
- Tölt/Running Walk: 4-beat, BPM אידיאלי 130-160
- Trot/Pace: 2-beat, BPM אידיאלי 140-170
- Walk: 4-beat, BPM אידיאלי 100-120
- Canter/Gallop: 3-beat, BPM אידיאלי 90-110
- אם המשרעות לא אחידות, זהו את ה-beats החלשים
- חלק את הקובץ ל-segments של 4-8 פעימות`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audioMetrics, horseName, breedId, dmrt3Genotype } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!audioMetrics || !audioMetrics.bpm) {
      return new Response(JSON.stringify({ error: "לא זוהו נתוני אודיו. ודאו שהסרטון מכיל צלילי פרסות ברורים." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let contextText = `נתוני אודיו שחולצו מסרטון אימון:
- BPM: ${audioMetrics.bpm}
- סדירות: ${audioMetrics.regularity}/100
- מספר פעימות: ${audioMetrics.beatCount}
- פעימה חלשה: ${audioMetrics.hasWeakBeat ? "כן" : "לא"}
- משרעות שיא (עד 20): ${JSON.stringify(audioMetrics.peakAmplitudes)}
- זמני פעימות (ms): ${JSON.stringify(audioMetrics.beatTimesMs || [])}`;

    if (horseName) contextText += `\nשם הסוס: ${horseName}`;
    if (breedId) contextText += `\nגזע: ${breedId}`;
    if (dmrt3Genotype) contextText += `\nגנוטיפ DMRT3: ${dmrt3Genotype}`;

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: contextText },
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
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "שגיאה בשירות AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

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
    console.error("gait-metronome error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
