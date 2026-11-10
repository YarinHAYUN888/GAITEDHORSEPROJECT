import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Clinical Condition Patterns Database =====

interface ClinicalSign {
  source: "gait" | "visual" | "audio";
  metric: string;
  condition: "gt" | "lt" | "eq";
  threshold: number;
  description: string;
  weight: number;
}

interface ConditionPattern {
  nameHe: string;
  nameEn: string;
  description: string;
  clinicalSigns: ClinicalSign[];
  riskFactors: string[];
  diagnosticPathway: string;
}

const CONDITION_PATTERNS: Record<string, ConditionPattern> = {
  subclinical_lameness: {
    nameHe: "צליעה סמויה",
    nameEn: "Subclinical Lameness",
    description: "אסימטריה בתנועה שאינה נראית לעין אך מזוהה במדידות",
    clinicalSigns: [
      { source: "gait", metric: "symmetry_score", condition: "lt", threshold: 7, description: "ציון סימטריה נמוך", weight: 3 },
      { source: "gait", metric: "asymmetry_percent", condition: "gt", threshold: 8, description: "אסימטריה > 8%", weight: 3 },
      { source: "gait", metric: "suspension_asymmetry", condition: "gt", threshold: 0.05, description: "אסימטריה ב-suspension", weight: 2 },
      { source: "audio", metric: "acoustic_asymmetry", condition: "gt", threshold: 0.15, description: "אסימטריה אקוסטית > 15%", weight: 2 },
    ],
    riskFactors: ["גיל מתקדם", "אימון אינטנסיבי", "משטח קשה"],
    diagnosticPathway: "בדיקת צליעה מלאה (flexion tests), רדיוגרפיה במידת הצורך",
  },
  kissing_spines: {
    nameHe: "Kissing Spines",
    nameEn: "Kissing Spines",
    description: "מגע בין זיזים בעמוד השדרה הגורם לכאב ומגבלת תנועה",
    clinicalSigns: [
      { source: "gait", metric: "stride_length_short", condition: "lt", threshold: 0.7, description: "קיצור צעד אחורי", weight: 3 },
      { source: "gait", metric: "back_extension_limited", condition: "lt", threshold: 5, description: "מגבלת extension בגב", weight: 3 },
      { source: "visual", metric: "hind_leg_extension", condition: "lt", threshold: 6, description: "extension אחורי מוגבל", weight: 2 },
    ],
    riskFactors: ["סוס ארוך גב", "רכיבה בישיבה כבדה", "חוסר אימון ליבה"],
    diagnosticPathway: "בדיקת גב, רדיוגרפיה של עמוד השדרה",
  },
  navicular_syndrome: {
    nameHe: "תסמונת הנביקולר",
    nameEn: "Navicular Syndrome",
    description: "שינויים ניווניים בעצם הנביקולר הגורמים לכאב כרוני",
    clinicalSigns: [
      { source: "gait", metric: "stride_shortening", condition: "gt", threshold: 15, description: "קיצור צעד קדמי > 15%", weight: 3 },
      { source: "gait", metric: "toe_first_landing", condition: "gt", threshold: 0.6, description: "נחיתה על קצה הפרסה", weight: 3 },
      { source: "audio", metric: "impact_variation", condition: "gt", threshold: 0.3, description: "שונות גבוהה בעוצמת פגיעה", weight: 2 },
    ],
    riskFactors: ["פרסות קטנות", "עבודה על משטח קשה", "משקל עודף"],
    diagnosticPathway: "בדיקת פרסה (hoof testers), רדיוגרפיה, MRI",
  },
  joint_overload: {
    nameHe: "עומס יתר על מפרקים",
    nameEn: "Joint Overload",
    description: "זוויות מפרק חריגות המצביעות על עומס מכני מוגזם",
    clinicalSigns: [
      { source: "gait", metric: "joint_angle_deviation", condition: "gt", threshold: 15, description: "סטיית זווית מפרק > 15°", weight: 3 },
      { source: "gait", metric: "fetlock_hyperextension", condition: "gt", threshold: 10, description: "היפר-אקסטנשן ב-fetlock", weight: 2 },
    ],
    riskFactors: ["אימון יתר", "מבנה גוף לא מאוזן", "משקל רוכב מוגזם"],
    diagnosticPathway: "הערכת מבנה גוף, רדיוגרפיה של מפרקים",
  },
  fatigue_pattern: {
    nameHe: "דפוס עייפות",
    nameEn: "Fatigue Pattern",
    description: "ירידה בביצועים המעידה על עייפות או חוסר כושר",
    clinicalSigns: [
      { source: "gait", metric: "overall_score_low", condition: "lt", threshold: 5, description: "ציון כללי נמוך", weight: 2 },
      { source: "audio", metric: "rhythm_regularity_low", condition: "lt", threshold: 0.5, description: "עקביות קצב נמוכה", weight: 2 },
      { source: "gait", metric: "lateral_sync_abnormal", condition: "lt", threshold: 40, description: "סנכרון צידי חריג", weight: 2 },
    ],
    riskFactors: ["אימון יתר", "תזונה לקויה", "חום"],
    diagnosticPathway: "בדיקת דם (CK, Lactate), הערכת תוכנית אימונים",
  },
  stringhalt: {
    nameHe: "סטרינגהולט",
    nameEn: "Stringhalt",
    description: "הרמת רגל אחורית מוגזמת ופתאומית — הפרעה נוירולוגית",
    clinicalSigns: [
      { source: "gait", metric: "hind_lift_excessive", condition: "gt", threshold: 0.3, description: "הרמת רגל אחורית מוגזמת", weight: 3 },
      { source: "gait", metric: "hind_lift_asymmetry", condition: "gt", threshold: 0.15, description: "אסימטריה בהרמת רגליים אחוריות", weight: 2 },
    ],
    riskFactors: ["חשיפה לרעלנים צמחיים", "טראומה"],
    diagnosticPathway: "בדיקה נוירולוגית, EMG",
  },
  laminitis: {
    nameHe: "למיניטיס (דלקת הפטריות)",
    nameEn: "Laminitis",
    description: "דלקת של הלמלות בפרסה — מצב חירום",
    clinicalSigns: [
      { source: "gait", metric: "stride_very_short", condition: "lt", threshold: 0.5, description: "צעד קצר מאוד", weight: 3 },
      { source: "gait", metric: "heel_first_landing", condition: "gt", threshold: 0.7, description: "נחיתה על העקב", weight: 3 },
      { source: "gait", metric: "reluctance_to_move", condition: "lt", threshold: 3, description: "חוסר רצון לנוע", weight: 3 },
      { source: "audio", metric: "impact_very_soft", condition: "lt", threshold: 0.3, description: "פגיעות רכות מאוד — נמנע ממגע קשה", weight: 2 },
    ],
    riskFactors: ["השמנה", "צריכת דגנים מוגזמת", "היסטוריה של למיניטיס", "שינוי פתאומי במזון"],
    diagnosticPathway: "בדיקה וטרינרית דחופה, רדיוגרפיה של הפרסות, בדיקת דופק דיגיטלי",
  },
};

// ===== Deterministic risk calculation =====

interface RiskResult {
  conditionName: string;
  conditionNameEn: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  matchedSigns: string[];
  confidence: number;
}

function calculateConditionRisk(analysis: any, horseHistory: any[]): RiskResult[] {
  const results: RiskResult[] = [];

  // Extract metrics from analysis
  const symmetryScore = analysis?.symmetry?.score ?? 10;
  const asymmetryPercent = analysis?.kinematicMetrics?.strideLength?.asymmetryPercent ?? 0;
  const overallScore = analysis?.overallScore ?? 10;
  const lateralSync = analysis?.lateralSync?.percentage ?? 50;
  const hindLegsExtension = analysis?.extension?.hindLegs ?? 10;
  const frontLegsExtension = analysis?.extension?.frontLegs ?? 10;
  const acousticAsymmetry = analysis?.audioAnalysis?.acousticAsymmetry ?? 0;
  const rhythmRegularity = analysis?.audioAnalysis?.rhythmRegularity ?? 1;
  const impactVariation = analysis?.audioAnalysis?.impactIntensityVariation ?? 0;
  const legLift = analysis?.kinematicMetrics?.legLiftHeight ?? {};
  const suspensionAsym = (() => {
    const s = analysis?.suspensionAnalysis;
    if (!s) return 0;
    const fl = s.FL?.ratio ?? 0, fr = s.FR?.ratio ?? 0;
    const hl = s.HL?.ratio ?? 0, hr = s.HR?.ratio ?? 0;
    return Math.max(Math.abs(fl - fr), Math.abs(hl - hr));
  })();

  // Evaluate each condition
  for (const [_key, pattern] of Object.entries(CONDITION_PATTERNS)) {
    const matchedSigns: string[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const sign of pattern.clinicalSigns) {
      totalWeight += sign.weight;

      let value: number | null = null;

      // Map metric names to actual values
      switch (sign.metric) {
        case "symmetry_score": value = symmetryScore; break;
        case "asymmetry_percent": value = asymmetryPercent; break;
        case "suspension_asymmetry": value = suspensionAsym; break;
        case "acoustic_asymmetry": value = acousticAsymmetry; break;
        case "stride_length_short": value = frontLegsExtension / 10; break;
        case "back_extension_limited": value = hindLegsExtension; break;
        case "hind_leg_extension": value = hindLegsExtension; break;
        case "stride_shortening": value = asymmetryPercent; break;
        case "toe_first_landing": value = 0; break; // Would need detailed hoof data
        case "impact_variation": value = impactVariation; break;
        case "joint_angle_deviation": value = 0; break; // Computed separately
        case "fetlock_hyperextension": value = 0; break;
        case "overall_score_low": value = overallScore; break;
        case "rhythm_regularity_low": value = rhythmRegularity; break;
        case "lateral_sync_abnormal": value = lateralSync; break;
        case "hind_lift_excessive": value = Math.max(legLift.HL ?? 0, legLift.HR ?? 0); break;
        case "hind_lift_asymmetry": value = Math.abs((legLift.HL ?? 0) - (legLift.HR ?? 0)); break;
        case "stride_very_short": value = frontLegsExtension / 10; break;
        case "heel_first_landing": value = 0; break;
        case "reluctance_to_move": value = overallScore; break;
        case "impact_very_soft": value = 1 - impactVariation; break;
        default: value = null;
      }

      if (value === null) continue;

      let matched = false;
      if (sign.condition === "gt" && value > sign.threshold) matched = true;
      if (sign.condition === "lt" && value < sign.threshold) matched = true;
      if (sign.condition === "eq" && Math.abs(value - sign.threshold) < 0.01) matched = true;

      if (matched) {
        matchedWeight += sign.weight;
        matchedSigns.push(sign.description);
      }
    }

    const riskScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
    const confidence = matchedSigns.length / Math.max(pattern.clinicalSigns.length, 1);

    let riskLevel: "low" | "medium" | "high" | "critical";
    if (riskScore >= 75) riskLevel = "critical";
    else if (riskScore >= 50) riskLevel = "high";
    else if (riskScore >= 25) riskLevel = "medium";
    else riskLevel = "low";

    // Boost risk if history shows recurring patterns
    const historyBoost = horseHistory.length > 2 ? 5 : 0;

    results.push({
      conditionName: pattern.nameHe,
      conditionNameEn: pattern.nameEn,
      riskScore: Math.min(100, riskScore + historyBoost),
      riskLevel,
      matchedSigns,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  return results.sort((a, b) => b.riskScore - a.riskScore);
}

// ===== LLM Prompt =====

const SYSTEM_PROMPT = `אתה וטרינר מומחה לפתולוגיה של סוסים עם התמחות בניתוח תנועה מבוסס טכנולוגיה.

מקבל:
1. תוצאות ניתוח תנועה (ראייה, אודיו, keypoints, קינמטיקה)
2. ציוני סיכון מקדימים שחושבו אלגוריתמית עבור מצבים רפואיים

מצבים רפואיים שעליך לבדוק:
- צליעה סמויה (Subclinical Lameness): אסימטריה > 8%, הבדלי suspension > 0.1
- Kissing Spines: קיצור צעד אחורי + מגבלת extension
- Navicular Syndrome: נחיתה על קצה הפרסה, קיצור צעד
- עומס יתר על מפרקים (Joint Overload): זוויות חריגות
- עייפות (Fatigue Pattern): ירידה בציון
- Stringhalt: הרמת רגל אחורית מוגזמת
- Wobbler Syndrome: חוסר קואורדינציה
- למיניטיס (Laminitis): צעד קצר מאוד, נחיתה על עקב

עקרונות:
- אל תגזים בסיכונים — היה מבוסס נתונים
- שלב בין כל מקורות הנתונים
- ציין ברמת ביטחון (confidence) כמה אתה בטוח

החזר JSON בלבד:
{
  "conditions": [
    {
      "name": "string (שם בעברית)",
      "nameEn": "string",
      "risk": "low|medium|high|critical",
      "confidence": number (0-1),
      "evidence": ["string — ראיות"],
      "recommendation": "string"
    }
  ],
  "alerts": [
    { "severity": "info|warning|critical", "message": "string" }
  ],
  "overallHealthScore": number (0-100),
  "primaryConcern": "string|null",
  "immediateActions": ["string"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const { analysisResult, horseHistory } = await req.json();
    if (!analysisResult) {
      return new Response(JSON.stringify({ error: "נדרשות תוצאות ניתוח" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Phase 1: Deterministic risk screening
    const safeHistory = Array.isArray(horseHistory) ? horseHistory : [];
    const preComputedRisks = calculateConditionRisk(analysisResult, safeHistory);
    const matchedSignsCount = preComputedRisks.reduce((sum, r) => sum + r.matchedSigns.length, 0);

    // Phase 2: AI deep analysis
    let prompt = `בדוק את תוצאות הניתוח הבאות עבור מצבים פתולוגיים:

תוצאות ניתוח:
${JSON.stringify(analysisResult, null, 2)}

ציוני סיכון מקדימים (חושבו אלגוריתמית):
${JSON.stringify(preComputedRisks.filter(r => r.riskScore > 0), null, 2)}`;

    if (safeHistory.length > 0) {
      prompt += `\n\nהיסטוריית ניתוחים קודמים (${safeHistory.length} רשומות):\n${JSON.stringify(safeHistory.slice(0, 5), null, 2)}`;
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
    return new Response(JSON.stringify({
      ...parsed,
      riskScreening: { preComputedRisks, matchedSignsCount },
      processing_time_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return new Response(JSON.stringify({ error: "הניתוח חרג ממגבלת הזמן (30 שניות)" }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("detect-equine-conditions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
