import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AUTO_SOURCE_PROMPT, QUICK_PROMPT, applyAutomaticSources, usableAudio } from "../_shared/automaticSources.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- Helper functions ---
function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function normalizeFrameToDataUrl(frame: string): string {
  if (frame.startsWith("data:image/")) return frame;
  if (frame.startsWith("http://") || frame.startsWith("https://")) return frame;
  return `data:image/jpeg;base64,${frame}`;
}

function downsampleFrames(frames: string[], maxFrames: number): string[] {
  if (frames.length <= maxFrames) return frames;
  const step = Math.ceil(frames.length / maxFrames);
  const sampled: string[] = [];
  for (let i = 0; i < frames.length && sampled.length < maxFrames; i += step) {
    sampled.push(frames[i]);
  }
  return sampled;
}

function extractJsonObject(rawContent: string): string | null {
  // Try fenced code block first: ```json ... ```
  const fenced = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) {
    const inner = fenced[1].trim();
    if (inner.startsWith("{")) return inner;
  }
  // Brace-matching: find first '{' and scan for matching '}'
  const start = rawContent.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < rawContent.length; i++) {
    const ch = rawContent[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return rawContent.substring(start, i + 1); }
  }
  // Unbalanced — return from start to end (will be handled by truncation logic)
  return rawContent.substring(start);
}

function repairTruncatedJson(jsonStr: string): string {
  // Remove trailing incomplete key-value (e.g., `"key": "incompl`)
  // Strip trailing partial string/number after last complete value
  let cleaned = jsonStr.replace(/,\s*"[^"]*"?\s*:\s*("[^"]*)?$/, "");
  cleaned = cleaned.replace(/,\s*$/, "");
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";
  return cleaned;
}

const GATEWAY_TIMEOUT_MS = 30_000;

// --- Motion Forecasting helpers ---
type LegId = "FL" | "FR" | "HL" | "HR";
type AudioMetricsInput = { bpm?: number; regularity?: number; hasWeakBeat?: boolean; signalToNoiseRatio?: number; [k: string]: unknown };
type MotionForecastOptions = { horizonSec?: number; fps?: number; audioMetrics?: AudioMetricsInput };

type PredictedEvent = {
  leg: LegId; event: "touchdown" | "liftoff"; tSec: number; frame: number; phase: number; source: "perLeg" | "audio" | "fallback";
};

type MotionForecast = {
  horizonSec: number; fps: number; strideDurationSec: number | null;
  model: { gaitFamily: "lateral-2beat" | "diagonal-2beat" | "four-beat" | "unknown"; phases: Record<LegId, number> };
  predictedEvents: PredictedEvent[]; forecastConfidence: number; notes: string[];
};

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }
function isFiniteNum(x: unknown): x is number { return typeof x === "number" && Number.isFinite(x); }

function inferGaitFamily(a: any): MotionForecast["model"]["gaitFamily"] {
  const g = String(a?.gaitType || a?.gait || "").toLowerCase();
  const ec = String(a?.overlap?.expectedCouplet || "").toLowerCase();
  if (ec.includes("lateral")) return "lateral-2beat";
  if (ec.includes("diagonal")) return "diagonal-2beat";
  if (ec.includes("4") || ec.includes("four")) return "four-beat";
  // broken gaits are 4-beat variants — must check BEFORE pure pace/trot
  if (g.includes("broken") || g.includes("singlefoot") || g.includes("rack")) return "four-beat";
  if (g.includes("pace") || g.includes("andadura")) return "lateral-2beat";
  if (g.includes("trot")) return "diagonal-2beat";
  if (g.includes("tolt") || g.includes("tölt") || g.includes("running") || g.includes("walk") || g.includes("fino")) return "four-beat";
  return "unknown";
}

function estimateStrideDuration(a: any, opts: MotionForecastOptions, notes: string[]): { sec: number | null; source: "perLeg" | "audio" | "fallback"; confidence: number } {
  const legs: LegId[] = ["FL", "FR", "HL", "HR"];
  const candidates: number[] = [];
  const perLeg = a?.suspensionAnalysis || a?.perLeg;
  if (perLeg && typeof perLeg === "object") {
    for (const leg of legs) {
      const L = perLeg[leg];
      const air = L?.airTimeMs ?? (L?.airTimeSec != null ? L.airTimeSec * 1000 : null);
      const ground = L?.groundTimeMs ?? (L?.groundTimeSec != null ? L.groundTimeSec * 1000 : null);
      if (isFiniteNum(air) && isFiniteNum(ground) && air > 0 && ground > 0) candidates.push((air + ground) / 1000);
    }
  }
  if (candidates.length >= 2) {
    const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
    const stride = Math.max(0.2, Math.min(2.5, avg));
    notes.push(`StrideDuration from perLeg avg=${stride.toFixed(3)}s`);
    return { sec: stride, source: "perLeg", confidence: 0.75 };
  }
  const bpm = opts.audioMetrics?.bpm;
  if (isFiniteNum(bpm) && bpm > 20 && bpm < 240) {
    const family = inferGaitFamily(a);
    const beatsPerCycle = family === "four-beat" ? 4 : (family === "lateral-2beat" || family === "diagonal-2beat" ? 2 : 4);
    const stride = Math.max(0.2, Math.min(2.5, (60 / bpm) * beatsPerCycle));
    const reg = opts.audioMetrics?.regularity;
    const regConf = isFiniteNum(reg) ? clamp01(reg / 100) : 0.6;
    notes.push(`StrideDuration from BPM=${bpm} (x${beatsPerCycle}) => ${stride.toFixed(3)}s`);
    return { sec: stride, source: "audio", confidence: 0.55 + 0.25 * regConf };
  }
  notes.push("StrideDuration fallback (1.0s).");
  return { sec: 1.0, source: "fallback", confidence: 0.25 };
}

function buildPhaseModel(family: MotionForecast["model"]["gaitFamily"], notes: string[]) {
  if (family === "lateral-2beat") { notes.push("Phase: lateral-2beat"); return { gaitFamily: family, phases: { FL: 0.0, HL: 0.0, FR: 0.5, HR: 0.5 } as Record<LegId, number> }; }
  if (family === "diagonal-2beat") { notes.push("Phase: diagonal-2beat"); return { gaitFamily: family, phases: { FL: 0.0, HR: 0.0, FR: 0.5, HL: 0.5 } as Record<LegId, number> }; }
  notes.push(`Phase: ${family === "four-beat" ? "four-beat" : "unknown→four-beat"}`);
  return { gaitFamily: family, phases: { FL: 0.0, HR: 0.25, FR: 0.5, HL: 0.75 } as Record<LegId, number> };
}

function estimateDutyCycle(a: any, leg: LegId): number | null {
  const L = (a?.suspensionAnalysis || a?.perLeg)?.[leg];
  const air = L?.airTimeMs ?? (L?.airTimeSec != null ? L.airTimeSec * 1000 : null);
  const ground = L?.groundTimeMs ?? (L?.groundTimeSec != null ? L.groundTimeSec * 1000 : null);
  if (isFiniteNum(air) && isFiniteNum(ground) && air > 0 && ground > 0) return ground / (air + ground);
  return null;
}

function predictMotionForecast(analysis: any, opts: MotionForecastOptions = {}): MotionForecast & { isFallback: boolean; strideSource: string } {
  const notes: string[] = [];
  const fps = isFiniteNum(opts.fps) && opts.fps! > 0 ? opts.fps! : 30;
  const MAX_HORIZON = 10;
  const rawHorizon = isFiniteNum(opts.horizonSec) && opts.horizonSec! > 0 ? opts.horizonSec! : 2.0;
  const horizonSec = Math.min(Math.max(rawHorizon, 0.5), MAX_HORIZON);
  if (rawHorizon !== horizonSec) notes.push(`horizonSec clamped: ${rawHorizon} → ${horizonSec}`);
  const family = inferGaitFamily(analysis);
  const phaseModel = buildPhaseModel(family, notes);
  const strideEst = estimateStrideDuration(analysis, opts, notes);
  const stride = isFiniteNum(strideEst.sec) ? strideEst.sec! : 1.0;
  const legs: LegId[] = ["FL", "FR", "HL", "HR"];
  const defaultDuty = family === "four-beat" ? 0.55 : 0.50;
  const duty: Record<LegId, number> = { FL: defaultDuty, FR: defaultDuty, HL: defaultDuty, HR: defaultDuty };
  for (const leg of legs) { const dc = estimateDutyCycle(analysis, leg); if (isFiniteNum(dc) && dc > 0.1 && dc < 0.9) duty[leg] = dc; }
  const events: PredictedEvent[] = [];
  const cycles = Math.max(1, Math.ceil(horizonSec / stride) + 1);
  for (let k = 0; k < cycles; k++) {
    const baseT = k * stride;
    for (const leg of legs) {
      const tdPhase = phaseModel.phases[leg];
      const loPhase = (tdPhase + duty[leg]) % 1.0;
      const tdT = baseT + tdPhase * stride;
      const loT = baseT + loPhase * stride;
      if (tdT >= 0 && tdT <= horizonSec) events.push({ leg, event: "touchdown", tSec: tdT, frame: Math.round(tdT * fps), phase: tdPhase, source: strideEst.source });
      if (loT >= 0 && loT <= horizonSec) events.push({ leg, event: "liftoff", tSec: loT, frame: Math.round(loT * fps), phase: loPhase, source: strideEst.source });
    }
  }
  events.sort((a, b) => a.tSec - b.tSec);
  let conf = strideEst.confidence;
  const ov = analysis?.overlap?.overlapPercent; if (isFiniteNum(ov)) conf += 0.10 * clamp01(ov > 1 ? ov / 100 : ov);
  const ar = opts.audioMetrics?.regularity; if (isFiniteNum(ar)) conf += 0.10 * clamp01(ar / 100);
  const snr = opts.audioMetrics?.signalToNoiseRatio; if (isFiniteNum(snr) && snr < 10) { conf -= 0.10; notes.push("Audio SNR<10dB: reduced confidence."); }
  const isFallback = strideEst.source === "fallback";
  if (isFallback) notes.push("⚠ Forecast is estimated only — no perLeg or audio data available.");
  return { horizonSec, fps, strideDurationSec: strideEst.sec, model: phaseModel, predictedEvents: events, forecastConfidence: clamp01(conf), notes, isFallback, strideSource: strideEst.source };
}

const BREED_DATA: Record<string, { nameHe: string; nameEn: string; gaits: string[]; dmrt3: string; characteristics: string[]; norms: string }> = {
  "standardbred": { nameHe: "סטנדרדברד", nameEn: "Standardbred", gaits: ["Trot", "Pace"], dmrt3: "AA/CA", characteristics: ["מהירות וסיבולת גבוהה", "מבנה חזק לרתמה"], norms: "BPM אופייני: 55-75. אורך צעד: 150-250 ס\"מ (pace), 130-200 ס\"מ (trot). Fetlock: 135-155°. Suspension ratio: 0.4-0.55." },
  "standardbred-trotter": { nameHe: "סטנדרדברד טרוטר", nameEn: "Standardbred Trotter", gaits: ["Trot"], dmrt3: "CC/CA", characteristics: ["diagonal couplet מושלם", "אורך צעד ארוך"], norms: "BPM אופייני: 55-70. אורך צעד: 130-200 ס\"מ. Diagonal sync > 95%. Fetlock: 138-155°. Suspension ratio: 0.4-0.5." },
  "standardbred-pacer": { nameHe: "סטנדרדברד פייסר", nameEn: "Standardbred Pacer", gaits: ["Pace"], dmrt3: "AA", characteristics: ["lateral couplet מהיר", "יציבות בקצב גבוה"], norms: "BPM אופייני: 55-75. אורך צעד: 150-250 ס\"מ. Lateral sync > 97%. Fetlock: 135-152°. Suspension ratio: 0.45-0.55." },
  "racking": { nameHe: "ראקינג / סינגלפוט", nameEn: "Racking / Singlefoot", gaits: ["Rack", "Singlefoot", "Walk"], dmrt3: "AA", characteristics: ["4-beat lateral gait מהיר ונקי", "רגל אחת בקרקע בכל רגע"], norms: "BPM אופייני: 80-120. אורך צעד: 80-130 ס\"מ. 4 פעימות נפרדות ברווח שווה. Fetlock: 140-160°." },
  "paso-fino": { nameHe: "פאסו פינו", nameEn: "Paso Fino", gaits: ["Classic Fino", "Paso Corto", "Paso Largo"], dmrt3: "AA", characteristics: ["צעד 4 פעימות מושלם", "נוחות רכיבה יוצאת דופן"], norms: "BPM אופייני: 100-120 (Fino), 60-80 (Corto). אורך צעד קצר מאוד ב-Fino (~40-60 ס\"מ). זוויות fetlock: 140-160°. גובה הרמת רגל נמוך (5-10 ס\"מ ב-Fino)." },
  "tennessee-walker": { nameHe: "טנסי ווקר", nameEn: "Tennessee Walking Horse", gaits: ["Flat Walk", "Running Walk", "Canter"], dmrt3: "AA/CA", characteristics: ["Running Walk ייחודי", "הנהון ראש בקצב"], norms: "BPM אופייני: 50-70 (Running Walk). אורך צעד ארוך: 100-150 ס\"מ. Overreach: 15-45 ס\"מ (מדד איכות). גובה הרמת רגל קדמית: 15-25 ס\"מ." },
  "icelandic": { nameHe: "איסלנדי", nameEn: "Icelandic Horse", gaits: ["Walk", "Trot", "Canter", "Tölt", "Flying Pace"], dmrt3: "AA", characteristics: ["5 צעדים טבעיים", "עמידות יוצאת דופן"], norms: "BPM אופייני: 70-100 (Tölt). אורך צעד: 80-120 ס\"מ. Tölt = 4-beat lateral. Flying Pace = 2-beat lateral מהיר (BPM 130+). Fetlock: 135-155°." },
  "missouri-fox-trotter": { nameHe: "מיזורי פוקס טרוטר", nameEn: "Missouri Fox Trotter", gaits: ["Flat Walk", "Fox Trot", "Canter"], dmrt3: "CA/AA", characteristics: ["Fox Trot ייחודי", "יציבות מעולה בשטח"], norms: "BPM אופייני: 60-80 (Fox Trot). אורך צעד: 90-130 ס\"מ. Fox Trot = diagonal couplet עם slide אחורי. Fetlock: 140-158°." },
  "peruvian-paso": { nameHe: "פרואני פאסו", nameEn: "Peruvian Paso", gaits: ["Paso Llano", "Sobreandando", "Huachano"], dmrt3: "AA", characteristics: ["תנועת Termino ייחודית", "צעד 4 פעימות שוות"], norms: "BPM אופייני: 60-90. אורך צעד: 70-110 ס\"מ. Termino (סיבוב כף יד החוצה) = מדד איכות. Fetlock: 138-155°." },
  "mangalarga-marchador": { nameHe: "מנגלרגה מרשדור", nameEn: "Mangalarga Marchador", gaits: ["Marcha Batida", "Marcha Picada", "Walk", "Canter"], dmrt3: "AA/CA", characteristics: ["שני סוגי Marcha", "סיבולת יוצאת דופן"], norms: "BPM אופייני: 55-75. Batida = diagonal tendency, Picada = lateral tendency. אורך צעד: 85-120 ס\"מ. Fetlock: 140-158°." },
};

const TRAINING_LEVELS: Record<string, string> = {
  beginner: "סוס מתחיל — בתחילת אימון. יש להתמקד בהמלצות בסיסיות ופשוטות.",
  intermediate: "סוס מתקדם — כבר שולט בבסיס. ניתן לתת המלצות ברמה בינונית-גבוהה.",
  professional: "סוס מקצועי — רמה גבוהה. תן ניתוח מתקדם ומפורט עם דגש על עדינויות.",
  rehab: "סוס בשיקום מפציעה — שים דגש מיוחד על סימטריה, צליעה סמויה, ועומס יתר. היזהר בהמלצות מאומצות.",
};

const GOAL_FOCUS: Record<string, string> = {
  performance: "המשתמש מעוניין בשיפור ביצועים. התמקד ב-Extension, נקיון הצעד, strideLength, overreach, ואיכות extension. תן המלצות לשדרוג הביצוע.",
  diagnosis: "המשתמש מחפש אבחון בעיה. התמקד ב-stanceDuration asymmetry (הבדל >15% = דגל אדום), weakBeat באודיו, legLiftHeight differences, וכל סימן לכאב או חוסר נוחות.",
  potential: "המשתמש רוצה להעריך פוטנציאל. התייחס לטווח זוויות מפרקים (jointAngles flexibility), מקצב טבעי, ומה ניתן לשפר באימון.",
  routine: "מעקב שגרתי. תן סקירה כללית תמציתית עם השוואה למצב תקין.",
};

const FILMING_CONDITIONS: Record<string, string> = {
  arena: "צולם במגרש אילוף — צפה לצעד מבוקר על משטח אחיד.",
  open: "צולם בשטח פתוח — התחשב במשטח לא אחיד, רוח וגירויים חיצוניים.",
  road: "צולם על כביש/אספלט — משטח קשה, שים לב להשפעה על הפרקים.",
  other: "תנאי צילום לא סטנדרטיים — נתח בהתאם למה שנראה בפריימים.",
};

const SYSTEM_PROMPT = `=== עקרונות מערכת ===
1. ניתוח מותאם לגזע ולייעוד — לא ניתוח כללי
2. פלט קצר, תכליתי, עם מסר אחד מרכזי
3. העדפה ל-Standardbred, Racking/Singlefoot, Pace, Trotter
4. Endurance = משני, רק אם היוזר בחר בו במפורש
5. אין להציג מידע שלא משרת את מטרת היוזר

=== מבנה פלט מועדף ===
1. תובנה מרכזית אחת (1-2 שורות) ב-summary
2. עד 3 נקודות ניתוח ממוקדות ב-trainingRecommendations
3. סיכום התאמה לגזע וצעד ב-breedSpecificNotes
4. המלצה מעשית אחת ב-goalFocusedSummary

אין לכלול הסברים תיאורטיים מיותרים. אין להציף את המשתמש בנתונים עודפים.

אתה מומחה עולמי לביומכניקה של סוסי צעד (Gaited Horses) ומאמן סוסים ותיק עם 30 שנות ניסיון.
המומחיות המרכזית שלך: Standardbred (Trotter & Pacer), Racking/Singlefoot, ו-Pace horses.

כתוב כמאמן מקצועי: השתמש בשפה מעשית, ישירה ומאמנת. תן דגשים ברורים למה לשפר ואיך. דבר בגובה העיניים של מאמן סוסים מנוסה.

עליך לנתח את התמונות ולהחזיר JSON מובנה בלבד (ללא טקסט נוסף) עם המבנה הבא:

{
  "gaitType": "pace" | "trot" | "tölt" | "running_walk" | "fox_trot" | "paso_fino" | "paso_largo" | "paso_corto" | "marcha_batida" | "marcha_picada" | "andadura" | "unknown",
  "gaitTypeHebrew": "שם הצעד בעברית",
  "confidence": 0-100,
  "beatPattern": "2-beat" | "4-beat" | "4-beat-lateral" | "4-beat-diagonal" | "unknown",
  "lateralSync": {
    "percentage": 0-100,
    "description": "תיאור הסינכרון הלטרלי"
  },
  "symmetry": {
    "score": 0-100,
    "leftRightDifference": 0-15,
    "lamenessRisk": "none" | "low" | "moderate" | "high",
    "lamenessDescription": "תיאור ממצאי סימטריה"
  },
  "extension": {
    "frontLegs": 0-180,
    "hindLegs": 0-180,
    "quality": "poor" | "fair" | "good" | "excellent",
    "description": "תיאור פתיחת הרגליים"
  },
  "keypoints": {
    "detected": true | false,
    "frontLeft": { "hoof": [x,y], "fetlock": [x,y], "carpus": [x,y], "shoulder": [x,y] },
    "frontRight": { "hoof": [x,y], "fetlock": [x,y], "carpus": [x,y], "shoulder": [x,y] },
    "hindLeft": { "hoof": [x,y], "fetlock": [x,y], "stifle": [x,y], "hip": [x,y] },
    "hindRight": { "hoof": [x,y], "fetlock": [x,y], "stifle": [x,y], "hip": [x,y] }
  },
  "beatTracker": {
    "impactTimes": [
      { "leg": "FL" | "FR" | "HL" | "HR", "frameIndex": 0, "phase": "stance" | "swing" }
    ],
    "offsetPercentage": 0-100,
    "isDirty": true | false,
    "dirtyDescription": "תיאור אם הצעד 'מלוכלך'"
  },
  "kinematicMetrics": {
    "strideLength": { "left": number_cm, "right": number_cm, "asymmetryPercent": number },
    "stanceDuration": { "FL": number_ms, "FR": number_ms, "HL": number_ms, "HR": number_ms },
    "swingDuration": { "FL": number_ms, "FR": number_ms, "HL": number_ms, "HR": number_ms },
    "jointAngles": {
      "frontLeft": { "shoulder": degrees, "carpus": degrees, "fetlock": degrees },
      "frontRight": { "shoulder": degrees, "carpus": degrees, "fetlock": degrees },
      "hindLeft": { "hip": degrees, "stifle": degrees, "fetlock": degrees },
      "hindRight": { "hip": degrees, "stifle": degrees, "fetlock": degrees }
    },
    "legLiftHeight": { "FL": number_cm, "FR": number_cm, "HL": number_cm, "HR": number_cm },
    "overreachDistance": number_cm_or_null
  },
  "suspensionAnalysis": {
    "FL": { "airTimeMs": number, "groundTimeMs": number, "ratio": number_0_to_1, "liftoffFrame": number, "touchdownFrame": number },
    "FR": { "airTimeMs": number, "groundTimeMs": number, "ratio": number_0_to_1, "liftoffFrame": number, "touchdownFrame": number },
    "HL": { "airTimeMs": number, "groundTimeMs": number, "ratio": number_0_to_1, "liftoffFrame": number, "touchdownFrame": number },
    "HR": { "airTimeMs": number, "groundTimeMs": number, "ratio": number_0_to_1, "liftoffFrame": number, "touchdownFrame": number },
    "asymmetryAlerts": ["<string - התראות על הבדלים בין רגליים מקבילות>"]
  },
  "audioAnalysis": null,
  "multiModalFusion": {
    "visionGaitType": "סוג צעד מהוויז'ן",
    "audioGaitType": "סוג צעד מהאודיו (או null אם אין אודיו)",
    "agreement": true | false,
    "conflictDescription": "אם יש סתירה בין Vision לאודיו — תאר בדיוק מה הסתירה ומה המשמעות. למשל: העין רואה צעד נקי אבל האוזן שומעת גרירת רגליים = בעיית פרזול או עייפות",
    "fusedConfidence": 0-100,
    "dominantModality": "vision" | "audio" | "both"
  },
  "overallScore": 0-100,
  "calibration": {
    "referenceObject": "fence_rail" | "hoof" | "horse_height" | "none",
    "pixelsPerCm": number_or_null,
    "confidence": 0-100,
    "calibrationMethod": "תיאור שיטת הכיול שבוצעה — אובייקט ייחוס, גובה סוס, או ללא כיול"
  },
  "trainingRecommendations": ["המלצה 1", "המלצה 2", ...],
  "summary": "סיכום מפורט של הניתוח בעברית — כתוב כמאמן סוסים מנוסה",
  "breedSpecificNotes": "הערות ספציפיות לגזע (אם סופק מידע גזעי) — או null",
  "goalFocusedSummary": "סיכום ממוקד מטרה (אם סופקה מטרת ניתוח) — או null"
}

=== הנחיות חילוץ מדדים קינמטיים ===

חילוץ מדדים קינמטיים הוא חלק קריטי מהניתוח. בכל פריים, זהה את מיקום המפרקים (shoulder, carpus, fetlock, hoof ברגליים קדמיות; hip, stifle, fetlock, hoof ברגליים אחוריות) ומדוד:

1. **אורך צעד (strideLength)**: מדוד את המרחק בין שתי נגיעות עוקבות של אותה פרסה. אם סופק גובה הסוס, חשב בס"מ מוחלטים. אחרת, השתמש ביחסים ותן הערכה.

2. **זמני דריכה ותנופה (stanceDuration / swingDuration)**: הערך את משך שלב הדריכה (רגל על הקרקע) ושלב התנופה (רגל באוויר) לכל רגל, במילישניות.
   - כלל קריטי: הבדל >15% בזמני דריכה בין רגליים מקבילות (FL vs FR, HL vs HR) = סימן לצליעה סמויה!

3. **זוויות מפרקים (jointAngles)**: מדוד זוויות עבור כל רגל. זוויות fetlock תקינות: 135-160°. סטייה מעידה על עומס/בעיה.

4. **גובה הרמת רגל (legLiftHeight)**: הערך את הגובה המקסימלי שכל רגל מורמת מהקרקע. הבדל בין ימין לשמאל = אי-סימטריה.

5. **Overreach**: מרחק שבו הפרסה האחורית עוברת את טביעת הפרסה הקדמית באותו צד. ערך חיובי = סימן לאיכות צעד טובה (במיוחד ב-Running Walk ו-Tölt).

=== ניתוח זמן אוויר (Suspension Analysis) ===

זהו ניתוח קריטי לסוסי אנדדורה ופייס. עבור כל רגל:
1. **Liftoff (ניתוק)**: זהה את הפריים שבו הפרסה עוזבת את הקרקע.
2. **Touchdown (נחיתה)**: זהה את הפריים שבו הפרסה חוזרת לקרקע.
3. **Suspension Ratio**: חשב ratio = airTime / (airTime + groundTime). יחס אידיאלי: 0.35-0.55.
4. **הבדלים בין רגליים מקבילות**: אם ההפרש ב-ratio בין FL ו-FR (או HL ו-HR) > 0.05, צור התראת אסימטריה.
   דוגמה: "הרגל האחורית הימנית גוררת ב-0.02 שניות יותר מהשמאלית — דיוק שבלתי אפשרי לראות בעין."

=== ידע מחקרי ===

- מחקרים מראים שמדדי צעידה (stride metrics) הם מפתח להערכת איכות תנועה. מערכת עם מצלמות סטריאו מדדה אורך צעד ומשך דריכה בדיוק גבוה (Peham et al.).
- אסימטריה בזמן דריכה >15% מעידה על כאב או צליעה סמויה (Buchner et al.).
- BPM ו-regularity מהקלטת אודיו מסווגים גייט בדיוק ~96% (Pfau et al.).
- DMRT3 AA → lateral couplet צפוי (pace/tölt). CC → diagonal couplet (trot). CA → גמיש.
- אי-סדירות מקצב >5% = "צעד מלוכלך" שדורש תיקון.
- Suspension ratio גבוה מדי (>0.6) = סוס "מעופף" — עומס נחיתה מוגבר = סיכון פציעה.
- Suspension ratio נמוך מדי (<0.25) = סוס "גורר" — חוסר אנרגיה או כאב.

=== כיול אוטומטי (Auto-Calibration) ===

נסה לזהות חפצים ידועי-גודל בפריימים כדי לבצע כיול:
1. **גדר סטנדרטית**: מוט גדר בגובה ~120 ס"מ
2. **פרסת סוס**: רוחב פרסה ~12 ס"מ
3. **גובה סוס**: אם סופק horseHeightCm, השתמש בו כקנה מידה ראשי
4. אם לא ניתן לזהות חפץ — החזר referenceObject: "none" ו-confidence: 0

מלא את שדה calibration ב-JSON עם פרטי הכיול.

=== הנחיות ניתוח (גייט ספציפי) ===
- בפייס/אנדדורה: גלי הרגליים באותו צד צריכים לחפוף כמעט ב-100%. סטייה מעל 5% = צעד מלוכלך.
- בטרוט: גלי רגליים אלכסוניות צריכים לחפוף.
- בטולט: 4 פעימות נפרדות עם lateral couplet. BPM 70-100.
- Running Walk: 4 פעימות, overreach משמעותי, הנהון ראש בקצב.
- Fox Trot: diagonal couplet עם slide של הרגל האחורית.
- הבדל סימטריה מעל 3 מעלות בגובה הרמת הברך = סימן לעומס יתר או צליעה סמויה.
- Extension רחב יותר ומהיר יותר = סוס איכותי יותר באנדדורה.

אם קיבלת מידע על גנוטיפ DMRT3:
- AA: תן עדיפות לניתוח מקצבים לטרליים (Pace/Andadura/Tölt)
- CA: בדוק גמישות בין צעדים - הסוס יכול לבצע גם טרוט וגם צעדים לטרליים
- CC: צפה לטרוט דומיננטי

החזר אך ורק JSON תקין, ללא markdown, ללא הסברים נוספים.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  // --- JWT Auth Check ---
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Server misconfigured" }, { status: 500 });
  }
  const _authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await _authClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { frames, dmrt3Genotype, horseName, breedId, trainingLevel, analysisGoal, filmingCondition, notes, horseHeightCm, audioMetrics: inputAudio, calibrationData, primaryGoal, targetStyle, primaryUse, outputPreference, additionalInfo, fps, forecastHorizonSec, quickScan, automaticSources } = await req.json();
    const audioMetrics = automaticSources ? (usableAudio(inputAudio) ? inputAudio : undefined) : inputAudio;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return jsonResponse({ error: "No frames provided" }, { status: 400 });
    }

    // Filter out empty/invalid frames
    const validFrames = frames.filter((f: unknown) => typeof f === "string" && f.toString().trim().length > 20);
    if (validFrames.length === 0) {
      return jsonResponse({ error: "לא נמצאו פריימים תקינים בסרטון. נסו להעלות סרטון אחר." }, { status: 400 });
    }

    // Build dynamic context block
    const contextParts: string[] = [];

    if (horseName) {
      contextParts.push(`שם הסוס: ${horseName}`);
    }

    if (horseHeightCm) {
      contextParts.push(`גובה הסוס בגריסטה: ${horseHeightCm} ס"מ. השתמש במידע זה לחישוב אורכי צעד מוחלטים בס"מ. כל המדדים המרחביים צריכים להיות מכוילים לפי גובה זה.`);
    }

    if (dmrt3Genotype) {
      contextParts.push(`גנוטיפ DMRT3: ${dmrt3Genotype}. נתח בהתאם.`);
    }

    if (breedId && BREED_DATA[breedId]) {
      const breed = BREED_DATA[breedId];
      contextParts.push(`גזע: ${breed.nameHe} (${breed.nameEn})
צעדים אופייניים לגזע: ${breed.gaits.join(", ")}
DMRT3 אופייני לגזע: ${breed.dmrt3}
מאפייני גזע: ${breed.characteristics.join(", ")}
נורמות ביומכניות לגזע: ${breed.norms}
חשוב: נתח את הצעד בהקשר גזעי — מה תקין לגזע זה ומה חריג. השווה את המדדים הקינמטיים לנורמות הגזע.`);
    }

    if (trainingLevel && TRAINING_LEVELS[trainingLevel]) {
      contextParts.push(TRAINING_LEVELS[trainingLevel]);
    }

    if (analysisGoal && GOAL_FOCUS[analysisGoal]) {
      contextParts.push(`מטרת הניתוח: ${GOAL_FOCUS[analysisGoal]}`);
    }

    if (filmingCondition && FILMING_CONDITIONS[filmingCondition]) {
      contextParts.push(`תנאי צילום: ${FILMING_CONDITIONS[filmingCondition]}`);
    }

    if (notes) {
      contextParts.push(`הערות נוספות מהמשתמש: ${notes}`);
    }

    // Questionnaire context
    if (primaryGoal) {
      const goalMap: Record<string, string> = {
        "structure-match": "התאמת מבנה ותנועה לגזע — התמקד בהשוואת מבנה ותנועה לסטנדרט הגזעי",
        "performance": "שיפור ביצועי תנועה — התמקד ביעילות, קצב, יציבות ואיכות צעד",
        "risk-detection": "זיהוי מגבלות או סיכונים — התמקד בסימטריה, צליעה, עומס יתר",
        "general": "הערכה כללית — סקירה תמציתית של איכות התנועה",
      };
      contextParts.push(`מטרת הניתוח (מהשאלון): ${goalMap[primaryGoal] || primaryGoal}`);
    }

    if (targetStyle) {
      contextParts.push(`סגנון/גזע יעד (מהשאלון): ${targetStyle}. התאם את הניתוח לסגנון זה בלבד.`);
    }

    if (primaryUse) {
      const useMap: Record<string, string> = {
        "training": "שימוש: אימונים יומיומיים",
        "competition": "שימוש: תחרות — דגש על ביצועי שיא",
        "long-distance": "שימוש: רכיבה ארוכה — דגש על סיבולת ויעילות",
        "technique": "שימוש: שיפור טכניקה בסיסית",
      };
      contextParts.push(useMap[primaryUse] || `שימוש: ${primaryUse}`);
    }

    if (outputPreference && Array.isArray(outputPreference)) {
      if (outputPreference.includes("short")) {
        contextParts.push("העדפת פלט: תשובה קצרה וברורה. summary צריך להיות 2-3 משפטים בלבד. trainingRecommendations מוגבל ל-3.");
      }
      if (outputPreference.includes("recommendation")) {
        contextParts.push("העדפת פלט: המלצה מעשית אחת מרכזית ב-goalFocusedSummary.");
      }
    }

    if (additionalInfo) {
      contextParts.push(`מידע נוסף על הסוס (מהשאלון): ${additionalInfo}`);
    }

    // Calibration data from client-side wizard
    if (calibrationData) {
      contextParts.push(`=== נתוני כיול (Calibration Kit) ===
סוג סמן: ${calibrationData.markerType}
${calibrationData.referenceLength ? `אורך ייחוס: ${calibrationData.referenceLength} ס"מ` : ""}
${calibrationData.pixelsPerMeter ? `pixels_per_meter (הערכה ראשונית): ${calibrationData.pixelsPerMeter}` : ""}
זווית מצלמה: ${90 - (calibrationData.cameraAngle || 0)}° (סטייה מ-90°: ${calibrationData.cameraAngle || 0}°)
ביטחון כיול: ${calibrationData.confidence}%
שיטה: ${calibrationData.calibrationMethod}

חשוב: השתמש בנתוני הכיול לתיקון סטיות פרספקטיבה. אם הזווית > 15°, תקן מדדי מרחק ב-cos(angle).
אם סופק סמן (לא "none"), חפש אותו בפריימים ושפר את pixels_per_meter.
כל אורכי צעד ומהירויות חייבים להיות במטרים (לא פיקסלים) אם הכיול אמין (confidence > 50).`);
    }

    // Audio metrics from client-side analysis
    if (audioMetrics && quickScan) {
      contextParts.push(`Unverified acoustic rhythm metrics (not a recording or hoof-contact evidence): ${JSON.stringify(audioMetrics)}`);
    }
    if (audioMetrics && !quickScan) {
      contextParts.push(`=== נתוני אודיו שחולצו מהסרטון ===
BPM (פעימות לדקה): ${audioMetrics.bpm}
סדירות מקצב: ${audioMetrics.regularity}% (100 = מושלם)
מספר נקישות שזוהו: ${audioMetrics.beatCount}
נקישה חלשה: ${audioMetrics.hasWeakBeat ? "כן — ייתכן שרגל אחת לא נושאת משקל מלא" : "לא — כל הנקישות שוות בעוצמה"}
${audioMetrics.dominantFrequencies ? `תדרים דומיננטיים (FFT): ${audioMetrics.dominantFrequencies.join(", ")} Hz` : ""}
${audioMetrics.dragNoiseDetected !== undefined ? `רעש גרירה (תדרים נמוכים רציפים): ${audioMetrics.dragNoiseDetected ? "כן — ייתכן שהסוס גורר רגל או עייף" : "לא"}` : ""}
${audioMetrics.surfaceType ? `סיווג משטח (מאודיו): ${audioMetrics.surfaceType}` : ""}
${audioMetrics.signalToNoiseRatio !== undefined ? `יחס signal-to-noise: ${audioMetrics.signalToNoiseRatio} dB ${audioMetrics.signalToNoiseRatio < 10 ? "(רעש רקע גבוה — דיוק אודיו מופחת)" : "(איכות אודיו טובה)"}` : ""}

בהתבסס על נתוני האודיו, מלא את שדה "audioAnalysis" ב-JSON עם:
- detectedBPM: המספר שחולץ (${audioMetrics.bpm})
- rhythmRegularity: ${audioMetrics.regularity}
- beatPattern: סווג את דפוס הפעימות ("4-beat-even", "4-beat-uneven", "2-beat", "3-beat", "irregular")
- weakBeatDetected: ${audioMetrics.hasWeakBeat}
- weakBeatDescription: אם זוהתה נקישה חלשה, תאר מה זה מעיד
- audioGaitClassification: סווג את סוג הצעד על פי האודיו בלבד
- audioConfidence: 0-100 — כמה בטוח אתה בסיווג על בסיס האודיו

=== Cross-Modal Validation מחמיר (Vision↔Audio) ===
השווה בין סיווג הצעד החזותי לסיווג מהאודיו. בדוק במיוחד:
- אם הוויז'ן מזהה Pace (2-beat lateral) אבל האודיו מזהה 4 פעימות → "צעד מלוכלך" (Broken Gait)
- אם הוויז'ן מזהה Tölt אבל האודיו מזהה 2-beat → ייתכן pace ולא tölt
- **Beat Consistency ↔ Footfall**: ודא שכל נקישה באודיו תואמת footfall בוויז'ן. אם יש נקישה ללא footfall תואם (או להפך) — סמן כ-"phantom beat" או "silent footfall".
- **אמינות משוקללת**: חשב fusedConfidence כשקלול: vision_confidence * 0.6 + audio_confidence * 0.4. אם יש סתירה — הורד ב-20%.
${audioMetrics.dragNoiseDetected ? "- זוהה רעש גרירה באודיו — בדוק אם הוויז'ן מאשר גרירת רגל. אם כן, ציין איזו רגל." : ""}

=== FEIF Mapping (מיפוי לסטנדרט תחרותי) ===
אם סוג הצעד הוא Tölt — מפה את התוצאות לקריטריוני FEIF T1 (Beat Clarity, Tempo Consistency, Suppleness, Speed Range, Symmetry).
אם סוג הצעד הוא Pace/Andadura — מפה לקריטריוני FEIF F1 (Lateral Sync, Suspension, Speed, Beat Purity, Symmetry).
הוסף לשדה summary הערות על עמידה/אי-עמידה בדרישות FEIF.

=== Multi-Modal Fusion ===
חובה למלא את שדה "multiModalFusion":
1. השווה את מה שהעין רואה (Vision) למה שהאוזן שומעת (Audio)
2. אם הוויז'ן מראה צעד נקי אבל האודיו מגלה אי-סדירות — זה יכול להעיד על:
   - בעיית פרזול (שיער הפרסה לא מחושל נכון)
   - עייפות (הסוס מתחיל לגרור רגליים)
   - כאב סמוי (הסוס "מזייף" חזותית אך הקול מגלה)
3. תן ציון fusedConfidence — שקלול של שני המקורות (60% ויז'ן + 40% אודיו, -20% אם יש סתירה)
4. ציין dominantModality — איזה מקור אמין יותר במקרה הזה`);


    }

    // Build user message
    const userContent: any[] = [];

    if (contextParts.length > 0) {
      userContent.push({
        type: "text",
        text: `הקשר על הסוס והניתוח:\n${contextParts.join("\n\n")}`,
      });
    }

    userContent.push({
      type: "text",
      text: quickScan ? "Give a concise preliminary gait estimate and source quality assessment; do not generate per-frame measurements." : `נתח את ${frames.length} הפריימים הבאים מסרטון תנועה של סוס. זהה את סוג הצעד, הסינכרון, הסימטריה והמדדים שניתן להעריך.`,
    });

    // Safety: downsample + normalize frames
    const MAX_FRAMES = Number(Deno.env.get("MAX_FRAMES") || 60);
    const selectedFrames = downsampleFrames(validFrames, MAX_FRAMES).map((f: string) =>
      normalizeFrameToDataUrl(String(f))
    );

    for (const frame of selectedFrames) {
      userContent.push({
        type: "image_url",
        image_url: { url: frame },
      });
    }

    const LOVABLE_ENDPOINT = Deno.env.get("LOVABLE_ENDPOINT") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const LOVABLE_MODEL = Deno.env.get("LOVABLE_MODEL") || "google/gemini-2.5-flash";

    const gatewayController = new AbortController();
    const gatewayTimeout = setTimeout(() => gatewayController.abort(), GATEWAY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(LOVABLE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: LOVABLE_MODEL,
          max_tokens: 8000,
          messages: [
            { role: "system", content: quickScan ? QUICK_PROMPT : SYSTEM_PROMPT + (automaticSources ? AUTO_SOURCE_PROMPT : "") },
            { role: "user", content: userContent },
          ],
        }),
        signal: gatewayController.signal,
      });
    } catch (fetchErr) {
      clearTimeout(gatewayTimeout);
      if ((fetchErr as any)?.name === "AbortError") {
        console.error("AI gateway timeout after", GATEWAY_TIMEOUT_MS, "ms");
        return jsonResponse({ error: "שירות הניתוח עמוס כרגע — נסו שוב בעוד דקה." }, { status: 504 });
      }
      throw fetchErr;
    } finally {
      clearTimeout(gatewayTimeout);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse({ error: "חריגה ממגבלת בקשות. נסו שוב בעוד דקה." }, { status: 429 });
      }
      if (response.status === 402) {
        return jsonResponse({ error: "נדרשת הוספת קרדיטים לחשבון." }, { status: 402 });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return jsonResponse({ error: "שגיאה בשירות הניתוח" }, { status: 500 });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const finishReason = data.choices?.[0]?.finish_reason;

    if (!rawContent) {
      console.error("Empty AI response, finish_reason:", finishReason);
      return jsonResponse({ error: "לא התקבלה תשובה מה-AI. נסו שנית." }, { status: 500 });
    }

    // --- Robust JSON parsing with truncation handling ---
    let analysis: any;
    const wasTruncated = finishReason === "length" || finishReason === "MAX_TOKENS";
    try {
      const jsonMatch = extractJsonObject(String(rawContent));
      let jsonStr = jsonMatch ? jsonMatch : String(rawContent);

      if (wasTruncated) {
        console.warn("AI response was truncated (finish_reason:", finishReason, "), attempting safe repair");
        jsonStr = repairTruncatedJson(jsonStr);
      }

      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", String(rawContent).substring(0, 800));
      if (wasTruncated) {
        return jsonResponse({ error: "תשובת הניתוח נחתכה ולא ניתן לעבד אותה. נסו להעלות סרטון קצר יותר." }, { status: 502 });
      }
      return jsonResponse({ error: "שגיאה בעיבוד תוצאות הניתוח. נסו שנית." }, { status: 500 });
    }

    // Mark truncated results so UI can warn user
    if (wasTruncated) {
      analysis._truncated = true;
      analysis._warnings = [...(analysis._warnings || []), "AI response was truncated — some results may be incomplete. Consider uploading a shorter video."];
    }

    // --- Motion Forecast (non-breaking add-on) ---
    const requestedFps = Number(fps) > 0 && Number.isFinite(Number(fps)) ? Number(fps) : 30;
    const forecastHorizon = Number(forecastHorizonSec) > 0 && Number.isFinite(Number(forecastHorizonSec)) ? Number(forecastHorizonSec) : 2.0;
    if (!quickScan) analysis.motionForecast = predictMotionForecast(analysis, { fps: requestedFps, horizonSec: forecastHorizon, audioMetrics });

    // --- Sanity defaults (non-breaking) ---
    if (!analysis.calibration) {
      analysis.calibration = {
        referenceObject: "none",
        scaleCmPerPixel: null,
        confidence: 0,
        notes: "Server default: calibration missing",
      };
    }

    if (audioMetrics && !analysis.audioAnalysis) {
      analysis.audioAnalysis = {
        detectedBPM: audioMetrics.bpm ?? null,
        rhythmRegularity: audioMetrics.regularity ?? null,
        beatPattern: null,
        weakBeatDetected: audioMetrics.hasWeakBeat ?? null,
        weakBeatDescription: null,
        audioGaitClassification: null,
        audioConfidence: 0,
      };
    }

    if (audioMetrics && !analysis.multiModalFusion) {
      analysis.multiModalFusion = {
        visionGaitType: analysis.gaitType || null,
        audioGaitType: null,
        agreement: false,
        conflictDescription: "Server default: multiModalFusion missing",
        fusedConfidence: 0,
        dominantModality: "vision",
      };
    }

    // --- Server-side fusedConfidence validation ---
    if (analysis.multiModalFusion && audioMetrics) {
      const vConf = typeof analysis.confidence === "number" ? analysis.confidence / 100 : 0.5;
      const aConf = typeof analysis.multiModalFusion?.audioConfidence === "number"
        ? (analysis.multiModalFusion.audioConfidence > 1 ? analysis.multiModalFusion.audioConfidence / 100 : analysis.multiModalFusion.audioConfidence)
        : (typeof analysis.audioAnalysis?.audioConfidence === "number" ? analysis.audioAnalysis.audioConfidence / 100 : 0.3);
      let expectedFused = vConf * 0.6 + aConf * 0.4;
      if (analysis.multiModalFusion.agreement === false) expectedFused = Math.max(0, expectedFused - 0.20);
      expectedFused = Math.round(clamp01(expectedFused) * 100);
      analysis.multiModalFusion._serverExpectedFusedConfidence = expectedFused;
      analysis.multiModalFusion._serverValidated = true;
      // If AI's fusedConfidence is wildly off (>30 points), override
      const aiFused = analysis.multiModalFusion.fusedConfidence ?? 0;
      if (Math.abs(aiFused - expectedFused) > 30) {
        analysis.multiModalFusion._fusedConfidenceOverridden = true;
        analysis.multiModalFusion.fusedConfidence = expectedFused;
      }
    }

    if (automaticSources) applyAutomaticSources(analysis, audioMetrics);
    return jsonResponse({ analysis }, { status: 200 });
  } catch (e) {
    console.error("gait-analysis error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }, { status: 500 });
  }
});
