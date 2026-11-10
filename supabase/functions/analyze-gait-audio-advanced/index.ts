import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `אתה מומחה עולמי לניתוח אקוסטי של תנועת סוסים. אתה מנתח נתוני AudioMetrics שחולצו מאודיו של סרטון סוס בתנועה.

## סוגי צעדים והגדרותיהם האקוסטיות:
- **Walk**: 4 פגיעות למחזור, סדר לטראלי (HL→FL→HR→FR), BPM טיפוסי 80-120, ללא שלב ריחוף
- **Trot**: 2 פגיעות למחזור, זוגות אלכסוניים (FL+HR, FR+HL), BPM טיפוסי 140-180, שלב ריחוף קצר
- **Canter/Gallop**: 3 פגיעות למחזור, סדר א-סימטרי, BPM טיפוסי 90-110 (canter) / 110-140 (gallop)
- **Tölt**: 4 פגיעות למחזור, סדר לטראלי כמו walk אך עם שלב ריחוף, BPM טיפוסי 120-160, קצב שווה ונקי
- **Pace**: 2 פגיעות למחזור, זוגות לטראליים (FL+HL, FR+HR), BPM טיפוסי 130-170
- **Running Walk**: 4 פגיעות, דומה ל-walk אך מהיר יותר עם גלישה, BPM 100-140
- **Fox Trot**: 4 פגיעות, אלכסוני א-סינכרוני, BPM 130-160

## משימות הניתוח:
1. זהה את ה-BPM המדויק מדפוס הפגיעות
2. חשב עקביות קצב (rhythm regularity) — עד כמה המרווחים בין פגיעות אחידים
3. קבע מספר פעימות למחזור צעד (beatsPerStrideCycle)
4. מדוד שונות בעוצמת פגיעות (impactIntensityVariation) — 0=אחיד, 1=שונות מקסימלית
5. סווג את סוג הצעד האקוסטי
6. חשב אסימטריה אקוסטית (acousticAsymmetry) — הבדל בין צד שמאל לימין, 0-1
7. העריך יחס זמן קשר/ריחוף (contactFlightRatio) — זמן על הקרקע חלקי זמן באוויר
8. זהה phantom beats (פגיעות חלשות שמתמזגות עם חזקות)
9. זהה drag noise (גרירת פרסות)
10. זהה סגמנטים שונים (שינויי קצב תוך הסרטון)

## אימות צולב:
אם מסופק expected_gait_type מניתוח ראייה, התייחס אליו:
- אם הניתוח האקוסטי מסכים — ציין זאת
- אם יש סתירה — תאר את הסתירה ואת הסיבות האפשריות (מעבר בין צעדים, צעד שבור, שגיאת ראייה)

החזר JSON בלבד:
{
  "audioAnalysis": {
    "detectedBPM": number,
    "rhythmRegularity": number (0-1),
    "beatPattern": "string",
    "weakBeatDetected": boolean,
    "weakBeatDescription": "string",
    "audioGaitClassification": "walk|trot|canter|gallop|tölt|pace|running_walk|fox_trot",
    "audioConfidence": number (0-1),
    "beatsPerStrideCycle": number,
    "impactIntensityVariation": number (0-1),
    "acousticAsymmetry": number (0-1),
    "contactFlightRatio": number
  },
  "segments": [
    { "startSec": number, "endSec": number, "bpm": number, "gaitType": "string", "notes": "string" }
  ],
  "warnings": ["string"]
}`;

// Deterministic cross-modal validation
function performCrossModalValidation(
  audioResult: { audioGaitClassification: string; audioConfidence: number; rhythmRegularity: number; acousticAsymmetry?: number },
  expectedGaitType: string | null,
  visionSyncScore: number | null,
  snr: number | null
) {
  const audioGaitType = audioResult.audioGaitClassification?.toLowerCase() || "";
  const expectedNorm = expectedGaitType?.toLowerCase() || null;

  // Cross-modal agreement factor
  let crossModalAgreement = 0.7; // default: no vision data
  let gaitAgreement = false;
  let visionAudioMatch = 0.5;
  const validationFlags: string[] = [];
  let brokenGaitDetected = false;

  if (expectedNorm) {
    if (expectedNorm === audioGaitType) {
      crossModalAgreement = 1.0;
      gaitAgreement = true;
      visionAudioMatch = 0.9 + Math.min(0.1, (audioResult.audioConfidence || 0) * 0.1);
      validationFlags.push("HIGH_CONFIDENCE_MATCH");
    } else {
      // Check for related gaits (possible transition)
      const relatedPairs: Record<string, string[]> = {
        walk: ["tölt", "running_walk"],
        tölt: ["walk", "trot", "pace"],
        trot: ["tölt", "fox_trot"],
        pace: ["tölt", "trot"],
        canter: ["gallop"],
        gallop: ["canter"],
      };
      const isRelated = relatedPairs[expectedNorm]?.includes(audioGaitType) || relatedPairs[audioGaitType]?.includes(expectedNorm);

      if (isRelated) {
        crossModalAgreement = 0.6;
        visionAudioMatch = 0.5;
        validationFlags.push("POSSIBLE_TRANSITION");
        brokenGaitDetected = true;
      } else {
        crossModalAgreement = 0.4;
        visionAudioMatch = 0.2;
        validationFlags.push("CROSS_MODAL_CONFLICT");
        brokenGaitDetected = true;
      }
      gaitAgreement = false;
    }
  }

  // SNR factor (0-1 scale, capped)
  const snrFactor = snr != null ? Math.min(1.0, Math.max(0, snr / 30)) : 0.5;

  // Weighted reliability score
  const reliabilityScore =
    (audioResult.audioConfidence || 0.5) * 0.3 +
    (audioResult.rhythmRegularity || 0.5) * 0.25 +
    snrFactor * 0.2 +
    crossModalAgreement * 0.25;

  return {
    expectedGaitType: expectedGaitType || null,
    audioGaitType,
    gaitAgreement,
    visionAudioMatch: Math.round(visionAudioMatch * 100) / 100,
    reliabilityScore: Math.round(reliabilityScore * 100) / 100,
    brokenGaitDetected,
    validationFlags,
  };
}

// Generate recommendations based on findings
function generateRecommendations(
  audioResult: { acousticAsymmetry?: number; rhythmRegularity?: number; weakBeatDetected?: boolean },
  dragNoiseDetected: boolean,
  crossModal: { gaitAgreement: boolean; validationFlags: string[] }
): string[] {
  const recs: string[] = [];
  if ((audioResult.acousticAsymmetry ?? 0) > 0.15) recs.push("אסימטריה אקוסטית גבוהה — בדוק צליעה סמויה");
  if ((audioResult.rhythmRegularity ?? 1) < 0.6) recs.push("עקביות קצב נמוכה — שקול בדיקה וטרינרית");
  if (dragNoiseDetected) recs.push("זוהה רעש גרירה — ייתכן עייפות או בעיית פרסום");
  if (audioResult.weakBeatDetected) recs.push("זוהו phantom beats — ייתכן שהסוס מפצה ברגל חלשה");
  if (crossModal.validationFlags.includes("CROSS_MODAL_CONFLICT")) recs.push("חוסר התאמה בין ראייה לאודיו — צלם שוב מזווית טובה יותר");
  return recs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const { audioMetrics, breedId, dmrt3Genotype, expectedGaitType, visionSyncScore } = await req.json();
    if (!audioMetrics) {
      return new Response(JSON.stringify({ error: "נדרשים נתוני אודיו" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context for LLM
    let context = `נתוני אודיו שחולצו:\n${JSON.stringify(audioMetrics, null, 2)}`;
    if (breedId) context += `\nגזע: ${breedId}`;
    if (dmrt3Genotype && dmrt3Genotype !== "none") context += `\nגנוטיפ DMRT3: ${dmrt3Genotype}`;
    if (expectedGaitType) context += `\n\n--- נתוני ראייה לאימות צולב ---\nexpected_gait_type (מניתוח חזותי): ${expectedGaitType}`;
    if (visionSyncScore != null) context += `\nsync_score_from_vision: ${visionSyncScore}`;

    // 30s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

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
          { role: "user", content: context },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
    let content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) content = jsonMatch[1].trim();
    if (!content.startsWith("{")) {
      const idx = content.indexOf("{");
      if (idx !== -1) content = content.slice(idx);
    }

    const parsed = JSON.parse(content);
    const audioAnalysis = parsed.audioAnalysis || {};

    // Cross-modal validation
    const crossModalValidation = performCrossModalValidation(
      audioAnalysis,
      expectedGaitType || null,
      visionSyncScore ?? null,
      audioMetrics.signalToNoiseRatio ?? null
    );

    // Recommendations
    const recommendations = generateRecommendations(
      audioAnalysis,
      audioMetrics.dragNoiseDetected || false,
      crossModalValidation
    );

    const result = {
      audioAnalysis,
      segments: parsed.segments || [],
      crossModalValidation,
      recommendations,
      warnings: parsed.warnings || [],
      processing_time_ms: Date.now() - startTime,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return new Response(JSON.stringify({ error: "תם הזמן הקצוב לניתוח (30 שניות)" }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("analyze-gait-audio-advanced error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
