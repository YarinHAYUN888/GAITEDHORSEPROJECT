import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Conflict Reason Code enum =====
const VALID_CONFLICT_CODES = [
  "AUDIO_4BEAT_BUT_CONTACTS_UNSTABLE",
  "VISION_TROT_BUT_AUDIO_PACE",
  "KEYPOINTS_LOW_CONFIDENCE",
  "WINDOWS_DISAGREE_HIGH_ENTROPY",
  "RHYTHM_UNSTABLE",
  "SYNC_NOT_AVAILABLE",
  "SYMMETRY_MISMATCH",
  "BPM_MISMATCH",
] as const;

// ===== Deterministic pre-correlation with Agreement Breakdown =====

interface CorrelationResult {
  agreementScoreOverall: number;
  agreementBreakdown: { gaitType: number; rhythm: number; symmetry: number; contacts: number };
  conflictReasonCodes: string[];
  conflicts: Array<{ code: string; severity: string; actionHint: string; details?: string }>;
  discrepancies: string[];
  mergedInsights: string[];
}

function correlateModalities(
  visionResult: any,
  audioAnalysis: any | null,
  keypointsData: any[] | null,
  kinematicMetrics: any | null
): CorrelationResult {
  const discrepancies: string[] = [];
  const mergedInsights: string[] = [];
  const conflictReasonCodes: string[] = [];
  const conflicts: Array<{ code: string; severity: string; actionHint: string; details?: string }> = [];
  const breakdown = { gaitType: 1.0, rhythm: 1.0, symmetry: 1.0, contacts: 1.0 };

  // 1. Gait type agreement
  if (audioAnalysis?.audioGaitClassification && visionResult?.gaitType) {
    const vGait = visionResult.gaitType.toLowerCase();
    const aGait = audioAnalysis.audioGaitClassification.toLowerCase();
    if (vGait === aGait || vGait.includes(aGait) || aGait.includes(vGait)) {
      mergedInsights.push(`סוג צעד תואם בין ראייה לאודיו: ${visionResult.gaitType}`);
    } else {
      breakdown.gaitType = 0.0;
      discrepancies.push(`סוג צעד: ראייה=${visionResult.gaitType}, אודיו=${audioAnalysis.audioGaitClassification}`);
      conflictReasonCodes.push("VISION_TROT_BUT_AUDIO_PACE");
      conflicts.push({
        code: "VISION_TROT_BUT_AUDIO_PACE",
        severity: "warning",
        actionHint: "lower_confidence",
        details: `Vision: ${visionResult.gaitType}, Audio: ${audioAnalysis.audioGaitClassification}`,
      });
    }
  }

  // 2. BPM / rhythm agreement
  if (audioAnalysis?.detectedBPM && visionResult?.beatTracker?.impactTimes?.length > 1) {
    const audioBPM = audioAnalysis.detectedBPM;
    const impacts = visionResult.beatTracker.impactTimes;
    const avgInterval = impacts.length > 1
      ? (impacts[impacts.length - 1].frameIndex - impacts[0].frameIndex) / (impacts.length - 1)
      : 0;
    if (avgInterval > 0) {
      const visionBPM = 60 / (avgInterval / 30);
      const bpmDiff = Math.abs(audioBPM - visionBPM) / Math.max(audioBPM, visionBPM);
      if (bpmDiff <= 0.1) {
        mergedInsights.push(`BPM תואם: אודיו=${audioBPM}, ראייה≈${Math.round(visionBPM)}`);
      } else {
        breakdown.rhythm = Math.max(0, 1 - bpmDiff);
        discrepancies.push(`BPM: אודיו=${audioBPM}, הערכת ראייה≈${Math.round(visionBPM)} (הבדל ${Math.round(bpmDiff * 100)}%)`);
        if (bpmDiff > 0.25) {
          conflictReasonCodes.push("BPM_MISMATCH");
          conflicts.push({ code: "BPM_MISMATCH", severity: "info", actionHint: "none", details: `Diff: ${Math.round(bpmDiff * 100)}%` });
        }
      }
    }
  }

  // 3. Symmetry agreement
  if (visionResult?.symmetry?.score != null && kinematicMetrics?.strideLength?.asymmetryPercent != null) {
    const visionSym = visionResult.symmetry.score;
    const kpAsym = kinematicMetrics.strideLength.asymmetryPercent;
    const kpSym = 100 - kpAsym;
    const symDiff = Math.abs(visionSym - kpSym);
    if (symDiff <= 10) {
      mergedInsights.push(`סימטריה תואמת: ראייה=${visionSym}, keypoints=${Math.round(kpSym)}`);
    } else {
      breakdown.symmetry = Math.max(0, 1 - symDiff / 50);
      discrepancies.push(`סימטריה: ראייה=${visionSym}, keypoints=${Math.round(kpSym)} (הבדל ${Math.round(symDiff)})`);
      if (symDiff > 20) {
        conflictReasonCodes.push("SYMMETRY_MISMATCH");
        conflicts.push({ code: "SYMMETRY_MISMATCH", severity: "warning", actionHint: "lower_confidence", details: `Vision: ${visionSym}, KP: ${Math.round(kpSym)}` });
      }
    }
  }

  // 4. Contact event confidence
  if (keypointsData && keypointsData.length > 0) {
    const detected = keypointsData.filter((k: any) => k.detected).length;
    const ratio = detected / keypointsData.length;
    if (ratio < 0.5) {
      breakdown.contacts = ratio;
      conflictReasonCodes.push("KEYPOINTS_LOW_CONFIDENCE");
      conflicts.push({ code: "KEYPOINTS_LOW_CONFIDENCE", severity: "info", actionHint: "none", details: `${Math.round(ratio * 100)}% detected` });
    }
  }

  // No audio-video sync available
  if (!audioAnalysis || !visionResult?.beatTracker?.impactTimes?.length) {
    conflictReasonCodes.push("SYNC_NOT_AVAILABLE");
    conflicts.push({ code: "SYNC_NOT_AVAILABLE", severity: "info", actionHint: "none" });
  }

  // Weighted overall score
  const weights = { gaitType: 0.4, rhythm: 0.2, symmetry: 0.2, contacts: 0.2 };
  const agreementScoreOverall = Math.round(
    (breakdown.gaitType * weights.gaitType +
     breakdown.rhythm * weights.rhythm +
     breakdown.symmetry * weights.symmetry +
     breakdown.contacts * weights.contacts) * 100
  );

  if (discrepancies.length === 0 && mergedInsights.length > 0) {
    mergedInsights.push("כל המקורות מראים תמונה עקבית");
  }

  return { agreementScoreOverall, agreementBreakdown: breakdown, conflictReasonCodes, conflicts, discrepancies, mergedInsights };
}

// ===== LLM Prompt =====

const SYSTEM_PROMPT = `אתה מערכת מיזוג נתונים רב-מודאלית לניתוח תנועת סוסים.

מקבל נתונים ממספר מקורות:
1. תוצאות ניתוח חזותי (vision) — סוג גייט, ציון, סנכרון
2. ניתוח אודיו — BPM, דפוס קצב, סיווג
3. נתוני keypoints — נקודות אנטומיות
4. מדדים קינמטיים — זוויות מפרקים, אורך צעד, suspension
5. תוצאות קורלציה מקדימה — ציון הסכמה, אי-התאמות, תובנות

תפקידך:
- לנתח את הקורלציה המקדימה ולהעמיק בממצאים
- לזהות קונפליקטים נוספים שלא נתפסו בקורלציה הדטרמיניסטית
- לחשב confidence ממוזג (weighted average לפי איכות כל מקור)
- לייצר תוצאה מאוחדת שמשקללת את כל המקורות
- לציין איזה מקור דומיננטי
- לתת משקל שונה למקורות לפי אמינותם (keypoints > vision > audio בד"כ)

עבור כל מדד בפלט, עליך לציין ב-provenance מאיזה מקור הוא נגזר.
עבור conflictReasonCodes, השתמש רק בקודים הבאים:
AUDIO_4BEAT_BUT_CONTACTS_UNSTABLE, VISION_TROT_BUT_AUDIO_PACE, KEYPOINTS_LOW_CONFIDENCE, WINDOWS_DISAGREE_HIGH_ENTROPY, RHYTHM_UNSTABLE, SYNC_NOT_AVAILABLE, SYMMETRY_MISMATCH, BPM_MISMATCH

החזר JSON בלבד:
{
  "fusedResult": {
    "gaitType": "string",
    "gaitTypeHebrew": "string",
    "confidence": number,
    "overallScore": number,
    "summary": "string"
  },
  "multiModalFusion": {
    "visionGaitType": "string",
    "audioGaitType": "string|null",
    "agreement": boolean,
    "conflictDescription": "string",
    "fusedConfidence": number,
    "dominantModality": "vision|audio|both",
    "conflictReasonCodes": ["string"],
    "provenance": { "gaitType": "biomech|vision|audio|keypoints|weighted_avg|rule_based", "confidence": "...", "symmetry": "...", "rhythm": "..." }
  },
  "conflicts": [
    { "source1": "string", "source2": "string", "field": "string", "value1": "any", "value2": "any", "resolution": "string" }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const { visionResult, audioAnalysis, keypointsData, kinematicMetrics } = await req.json();
    if (!visionResult) {
      return new Response(JSON.stringify({ error: "נדרשות תוצאות ניתוח חזותי לפחות" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Pre-correlation with full breakdown
    const correlation = correlateModalities(visionResult, audioAnalysis, keypointsData, kinematicMetrics);

    const prompt = `מזג את הנתונים הבאים לתוצאה מאוחדת:

ניתוח חזותי:
${JSON.stringify(visionResult, null, 2)}

${audioAnalysis ? `ניתוח אודיו:\n${JSON.stringify(audioAnalysis, null, 2)}` : "אין נתוני אודיו."}

${keypointsData ? `נתוני keypoints:\n${JSON.stringify(keypointsData, null, 2)}` : "אין נתוני keypoints."}

${kinematicMetrics ? `מדדים קינמטיים:\n${JSON.stringify(kinematicMetrics, null, 2)}` : "אין מדדים קינמטיים."}

קורלציה מקדימה (דטרמיניסטית):
ציון הסכמה כולל: ${correlation.agreementScoreOverall}%
Breakdown: gaitType=${(correlation.agreementBreakdown.gaitType * 100).toFixed(0)}%, rhythm=${(correlation.agreementBreakdown.rhythm * 100).toFixed(0)}%, symmetry=${(correlation.agreementBreakdown.symmetry * 100).toFixed(0)}%, contacts=${(correlation.agreementBreakdown.contacts * 100).toFixed(0)}%
${correlation.conflictReasonCodes.length > 0 ? `Conflict codes: ${correlation.conflictReasonCodes.join(", ")}` : ""}
${correlation.discrepancies.length > 0 ? `אי-התאמות:\n${correlation.discrepancies.map(d => `- ${d}`).join("\n")}` : "אין אי-התאמות."}
${correlation.mergedInsights.length > 0 ? `תובנות:\n${correlation.mergedInsights.map(i => `- ${i}`).join("\n")}` : ""}`;

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
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "חריגה ממגבלת בקשות." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "נדרש תשלום — הוסיפו קרדיטים." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "שגיאה בשירות AI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Filter LLM conflictReasonCodes to valid enum values
    if (parsed.multiModalFusion?.conflictReasonCodes) {
      parsed.multiModalFusion.conflictReasonCodes = parsed.multiModalFusion.conflictReasonCodes.filter(
        (c: string) => VALID_CONFLICT_CODES.includes(c as any)
      );
    }

    // Merge deterministic + LLM conflict reason codes (dedup)
    const allConflictCodes = [...new Set([
      ...correlation.conflictReasonCodes,
      ...(parsed.multiModalFusion?.conflictReasonCodes || []),
    ])];

    // Build final output with full metadata
    const result = {
      ...parsed,
      preCorrelation: {
        agreementScoreOverall: correlation.agreementScoreOverall,
        agreementBreakdown: correlation.agreementBreakdown,
        conflictReasonCodes: allConflictCodes,
        conflicts: correlation.conflicts,
        discrepancies: correlation.discrepancies,
        mergedInsights: correlation.mergedInsights,
      },
      fusionLevel: "summary",
      limitations: audioAnalysis ? [] : ["NO_AUDIO_VIDEO_SYNC"],
      processing_time_ms: Date.now() - startTime,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return new Response(JSON.stringify({ error: "הניתוח חרג ממגבלת הזמן (30 שניות)" }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.error("merge-multimodal-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
