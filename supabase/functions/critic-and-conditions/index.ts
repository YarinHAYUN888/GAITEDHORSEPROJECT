import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Combined System Prompt: Critic + Conditions (Screening) in one pass =====

const SYSTEM_PROMPT = `You are a dual-role equine expert performing TWO tasks in one pass on horse gait analysis data.

=== TASK 1: GAIT CONSISTENCY CRITIC ===
Verify whether the proposed gait classification is consistent with the biomechanical evidence.
You are a GATING model only — you CANNOT replace the classification directly.
If data is inconsistent, provide alternatives with scores and list contradictions.
Be conservative: approve unless there is STRONG evidence of inconsistency.

Expected ranges per classification:
- diagonal (trot): meanDiagonalLag < 20ms, meanLateralLag > 60ms
- lateral (pace): meanLateralLag < 20ms, meanDiagonalLag > 60ms
- singlefoot: both lags > 30ms, latLag/diagLag ratio < 0.7, beatEvenness > 0.6
- four_beat (tölt): both lags > 30ms, ratio >= 0.7, beatEvenness > 0.7
- broken_pace: ratio < 0.7, beatEvenness < 0.6, pacer breed

=== TASK 2: RISK SCREENING (NOT DIAGNOSIS) ===
IMPORTANT: This is a SCREENING SUPPORT TOOL ONLY — NOT a clinical diagnosis.
Results must be clearly marked as screening and require veterinary review.

Check the analysis results for potential risk indicators:
- Subclinical Lameness: asymmetry > 8%, suspension differences > 0.1
- Kissing Spines: shortened hind stride + limited back extension
- Navicular Syndrome: toe-first landing, stride shortening
- Joint Overload: abnormal joint angles
- Fatigue Pattern: declining scores
- Stringhalt: excessive hind leg lift
- Laminitis: very short stride, heel-first landing

Principles:
- Don't exaggerate risks — be data-driven
- Cross-reference all data sources
- State confidence levels
- For each condition, list the specific objective metrics that support it with their values and units

RESPOND WITH STRICT JSON ONLY (no markdown):
{
  "critic": {
    "approved": boolean,
    "confidenceAdjustment": number (multiplier 0.5..1.2),
    "alternatives": [{"classification": string, "score": number}],
    "reasonCodes": string[],
    "contradictions": [{"metric": string, "observed": number, "expectedRange": string}]
  },
  "conditions": {
    "conditions": [
      {
        "name": "string (Hebrew name)",
        "nameEn": "string",
        "risk": "low|medium|high|critical",
        "confidence": number (0-1),
        "evidence": ["string"],
        "recommendation": "string",
        "objectiveMetricsUsed": ["string"],
        "structuredEvidence": [{"metric": "string", "value": number, "unit": "string", "threshold": "string", "direction": "high|low|unstable"}]
      }
    ],
    "alerts": [{"severity": "info|warning|critical", "message": "string"}],
    "overallHealthScore": number (0-100),
    "primaryConcern": "string|null",
    "immediateActions": ["string"]
  }
}`;

// ===== Deterministic condition risk (same as detect-equine-conditions) =====

interface ClinicalSign {
  source: string;
  metric: string;
  condition: "gt" | "lt" | "eq";
  threshold: number;
  description: string;
  weight: number;
}

interface ConditionPattern {
  nameHe: string;
  nameEn: string;
  clinicalSigns: ClinicalSign[];
}

const CONDITION_PATTERNS: Record<string, ConditionPattern> = {
  subclinical_lameness: {
    nameHe: "צליעה סמויה", nameEn: "Subclinical Lameness",
    clinicalSigns: [
      { source: "gait", metric: "symmetry_score", condition: "lt", threshold: 7, description: "ציון סימטריה נמוך", weight: 3 },
      { source: "gait", metric: "asymmetry_percent", condition: "gt", threshold: 8, description: "אסימטריה > 8%", weight: 3 },
      { source: "gait", metric: "suspension_asymmetry", condition: "gt", threshold: 0.05, description: "אסימטריה ב-suspension", weight: 2 },
      { source: "audio", metric: "acoustic_asymmetry", condition: "gt", threshold: 0.15, description: "אסימטריה אקוסטית > 15%", weight: 2 },
    ],
  },
  kissing_spines: {
    nameHe: "Kissing Spines", nameEn: "Kissing Spines",
    clinicalSigns: [
      { source: "gait", metric: "stride_length_short", condition: "lt", threshold: 0.7, description: "קיצור צעד אחורי", weight: 3 },
      { source: "gait", metric: "back_extension_limited", condition: "lt", threshold: 5, description: "מגבלת extension בגב", weight: 3 },
      { source: "visual", metric: "hind_leg_extension", condition: "lt", threshold: 6, description: "extension אחורי מוגבל", weight: 2 },
    ],
  },
  fatigue_pattern: {
    nameHe: "דפוס עייפות", nameEn: "Fatigue Pattern",
    clinicalSigns: [
      { source: "gait", metric: "overall_score_low", condition: "lt", threshold: 5, description: "ציון כללי נמוך", weight: 2 },
      { source: "audio", metric: "rhythm_regularity_low", condition: "lt", threshold: 0.5, description: "עקביות קצב נמוכה", weight: 2 },
      { source: "gait", metric: "lateral_sync_abnormal", condition: "lt", threshold: 40, description: "סנכרון צידי חריג", weight: 2 },
    ],
  },
  stringhalt: {
    nameHe: "סטרינגהולט", nameEn: "Stringhalt",
    clinicalSigns: [
      { source: "gait", metric: "hind_lift_excessive", condition: "gt", threshold: 0.3, description: "הרמת רגל אחורית מוגזמת", weight: 3 },
      { source: "gait", metric: "hind_lift_asymmetry", condition: "gt", threshold: 0.15, description: "אסימטריה בהרמת רגליים אחוריות", weight: 2 },
    ],
  },
  laminitis: {
    nameHe: "למיניטיס", nameEn: "Laminitis",
    clinicalSigns: [
      { source: "gait", metric: "stride_very_short", condition: "lt", threshold: 0.5, description: "צעד קצר מאוד", weight: 3 },
      { source: "gait", metric: "reluctance_to_move", condition: "lt", threshold: 3, description: "חוסר רצון לנוע", weight: 3 },
    ],
  },
};

function calculateConditionRisk(analysis: any): Array<{ conditionName: string; riskScore: number; matchedSigns: string[] }> {
  const results: Array<{ conditionName: string; riskScore: number; matchedSigns: string[] }> = [];
  const symmetryScore = analysis?.symmetry?.score ?? 10;
  const asymmetryPercent = analysis?.kinematicMetrics?.strideLength?.asymmetryPercent ?? 0;
  const overallScore = analysis?.overallScore ?? 10;
  const lateralSync = analysis?.lateralSync?.percentage ?? 50;
  const hindLegsExtension = analysis?.extension?.hindLegs ?? 10;
  const frontLegsExtension = analysis?.extension?.frontLegs ?? 10;
  const acousticAsymmetry = analysis?.audioAnalysis?.acousticAsymmetry ?? 0;
  const rhythmRegularity = analysis?.audioAnalysis?.rhythmRegularity ?? 1;
  const legLift = analysis?.kinematicMetrics?.legLiftHeight ?? {};
  const suspensionAsym = (() => {
    const s = analysis?.suspensionAnalysis;
    if (!s) return 0;
    const fl = s.FL?.ratio ?? 0, fr = s.FR?.ratio ?? 0;
    const hl = s.HL?.ratio ?? 0, hr = s.HR?.ratio ?? 0;
    return Math.max(Math.abs(fl - fr), Math.abs(hl - hr));
  })();

  for (const [, pattern] of Object.entries(CONDITION_PATTERNS)) {
    const matchedSigns: string[] = [];
    let totalWeight = 0, matchedWeight = 0;
    for (const sign of pattern.clinicalSigns) {
      totalWeight += sign.weight;
      let value: number | null = null;
      switch (sign.metric) {
        case "symmetry_score": value = symmetryScore; break;
        case "asymmetry_percent": value = asymmetryPercent; break;
        case "suspension_asymmetry": value = suspensionAsym; break;
        case "acoustic_asymmetry": value = acousticAsymmetry; break;
        case "stride_length_short": value = frontLegsExtension / 10; break;
        case "back_extension_limited": value = hindLegsExtension; break;
        case "hind_leg_extension": value = hindLegsExtension; break;
        case "overall_score_low": value = overallScore; break;
        case "rhythm_regularity_low": value = rhythmRegularity; break;
        case "lateral_sync_abnormal": value = lateralSync; break;
        case "hind_lift_excessive": value = Math.max(legLift.HL ?? 0, legLift.HR ?? 0); break;
        case "hind_lift_asymmetry": value = Math.abs((legLift.HL ?? 0) - (legLift.HR ?? 0)); break;
        case "stride_very_short": value = frontLegsExtension / 10; break;
        case "reluctance_to_move": value = overallScore; break;
        default: value = null;
      }
      if (value === null) continue;
      let matched = false;
      if (sign.condition === "gt" && value > sign.threshold) matched = true;
      if (sign.condition === "lt" && value < sign.threshold) matched = true;
      if (matched) { matchedWeight += sign.weight; matchedSigns.push(sign.description); }
    }
    const riskScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
    results.push({ conditionName: pattern.nameHe, riskScore, matchedSigns });
  }
  return results.filter(r => r.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const body = await req.json();
    const { criticInput, analysisResult, horseHistory } = body;

    if (!criticInput && !analysisResult) {
      return new Response(JSON.stringify({ error: "criticInput or analysisResult required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build pre-computed condition risks
    const preComputedRisks = analysisResult ? calculateConditionRisk(analysisResult) : [];

    // Build unified prompt
    let prompt = "";

    if (criticInput) {
      prompt += `=== CRITIC DATA ===
Classification: ${criticInput.classification}
Confidence: ${criticInput.confidence}

Feature Vector:
${JSON.stringify(criticInput.features, null, 2)}

Window Vote Breakdown: ${JSON.stringify(criticInput.windowVoteBreakdown)}
Quality Windows: ${criticInput.qualityWindows} / ${criticInput.totalWindows}
Std Beat Evenness: ${criticInput.stdBeatEvenness ?? "N/A"}
Std Order Consistency: ${criticInput.stdOrderConsistency ?? "N/A"}

`;
    }

    if (analysisResult) {
      prompt += `=== CONDITIONS DATA ===
Analysis Result (key fields):
${JSON.stringify({
  gaitType: analysisResult.gaitType,
  overallScore: analysisResult.overallScore,
  confidence: analysisResult.confidence,
  symmetry: analysisResult.symmetry,
  lateralSync: analysisResult.lateralSync,
  extension: analysisResult.extension,
  beatPattern: analysisResult.beatPattern,
  audioAnalysis: analysisResult.audioAnalysis ? {
    bpm: analysisResult.audioAnalysis.bpm,
    regularity: analysisResult.audioAnalysis.regularity,
    acousticAsymmetry: analysisResult.audioAnalysis.acousticAsymmetry,
  } : null,
}, null, 2)}

Pre-computed risk scores:
${JSON.stringify(preComputedRisks, null, 2)}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0,
        top_p: 0.1,
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
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
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

    // Clamp critic confidence adjustment
    if (parsed.critic && typeof parsed.critic.confidenceAdjustment === "number") {
      parsed.critic.confidenceAdjustment = Math.max(0.5, Math.min(1.2, parsed.critic.confidenceAdjustment));
    } else if (parsed.critic) {
      parsed.critic.confidenceAdjustment = 1.0;
    }

    // Attach metadata
    parsed.riskScreening = { preComputedRisks, matchedSignsCount: preComputedRisks.reduce((s: any, r: any) => s + r.matchedSigns.length, 0) };
    parsed.processing_time_ms = Date.now() - startTime;

    // Attach screening-only flags (deterministic, not LLM-dependent)
    if (parsed.conditions) {
      parsed.conditions.screeningOnly = true;
      parsed.conditions.intendedUse = "screening_support";
      parsed.conditions.notDiagnostic = true;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return new Response(JSON.stringify({ error: "Timeout (30s)" }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("critic-and-conditions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
