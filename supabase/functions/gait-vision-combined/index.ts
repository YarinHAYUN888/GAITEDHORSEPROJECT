import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AUTO_SOURCE_PROMPT, applyAutomaticSources, usableAudio } from "../_shared/automaticSources.ts";

const corsHeaders = {
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
  const fenced = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) {
    const inner = fenced[1].trim();
    if (inner.startsWith("{")) return inner;
  }
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
  return rawContent.substring(start);
}

function repairTruncatedJson(jsonStr: string): string {
  let cleaned = jsonStr;
  // Strip trailing code fences
  cleaned = cleaned.replace(/```\s*$/g, "").trim();
  // If ends inside an unterminated string, cut back to last complete boundary
  // Count unescaped quotes; if odd, drop everything after the last valid comma/brace/bracket
  const quotes = (cleaned.match(/(?<!\\)"/g) || []).length;
  if (quotes % 2 !== 0) {
    const lastSafe = Math.max(
      cleaned.lastIndexOf('",'),
      cleaned.lastIndexOf('"}'),
      cleaned.lastIndexOf('"]'),
      cleaned.lastIndexOf('},'),
      cleaned.lastIndexOf('],'),
      cleaned.lastIndexOf('}'),
      cleaned.lastIndexOf(']'),
    );
    if (lastSafe > 0) cleaned = cleaned.substring(0, lastSafe + 1);
  }
  // Remove dangling partial key like ,"foo":
  cleaned = cleaned.replace(/,\s*"[^"]*"\s*:\s*[^,\}\]]*$/, "");
  cleaned = cleaned.replace(/,\s*"[^"]*$/, "");
  cleaned = cleaned.replace(/,\s*$/, "");
  const openB = (cleaned.match(/\{/g) || []).length;
  const closeB = (cleaned.match(/\}/g) || []).length;
  const openA = (cleaned.match(/\[/g) || []).length;
  const closeA = (cleaned.match(/\]/g) || []).length;
  for (let i = 0; i < openA - closeA; i++) cleaned += "]";
  for (let i = 0; i < openB - closeB; i++) cleaned += "}";
  return cleaned;
}

const GATEWAY_TIMEOUT_MS = 25_000;

// --- Scientific validation against published research norms ---
// Refs: Clayton 2013 (joint angles), Hobbs 2016 (weight/dissociation),
// Rhodin 2018 (symmetry), AAEP scale, FEIF beat-evenness, Nicodemus 2003 (tölt).
type ValidationFlag = { field: string; value: unknown; expected: string; severity: "info" | "warning" | "error"; reference: string };

function validateAgainstResearch(analysis: any): { flags: ValidationFlag[]; passedCount: number; checkedCount: number } {
  const flags: ValidationFlag[] = [];
  let passed = 0; let checked = 0;

  const inRange = (v: unknown, lo: number, hi: number) => isFiniteNum(v) && (v as number) >= lo && (v as number) <= hi;
  const check = (cond: boolean, flag: () => ValidationFlag) => { checked++; if (cond) passed++; else flags.push(flag()); };

  // Joint angles (Clayton 2013) — only validate if AI returned numeric values
  const ja = analysis?.kinematicMetrics?.jointAngles;
  if (ja) {
    const checkAngle = (path: string, val: unknown, lo: number, hi: number, ref: string) => {
      if (!isFiniteNum(val) || val === 0) return; // skip nulls/zeros
      check(inRange(val, lo, hi), () => ({
        field: path, value: val, expected: `${lo}-${hi}°`, severity: "warning", reference: ref,
      }));
    };
    for (const side of ["frontLeft", "frontRight"] as const) {
      checkAngle(`jointAngles.${side}.shoulder`, ja[side]?.shoulder, 100, 140, "Clayton 2013");
      checkAngle(`jointAngles.${side}.carpus`, ja[side]?.carpus, 160, 185, "Clayton 2013");
      checkAngle(`jointAngles.${side}.fetlock`, ja[side]?.fetlock, 130, 245, "Clayton 2013");
    }
    for (const side of ["hindLeft", "hindRight"] as const) {
      checkAngle(`jointAngles.${side}.hip`, ja[side]?.hip, 80, 130, "Clayton 2013");
      checkAngle(`jointAngles.${side}.stifle`, ja[side]?.stifle, 130, 165, "Clayton 2013");
      checkAngle(`jointAngles.${side}.fetlock`, ja[side]?.fetlock, 130, 245, "Clayton 2013");
    }
  }

  // Symmetry / lameness (Hobbs 2016, Rhodin 2018, FEIF)
  const sym = analysis?.symmetry;
  if (sym && isFiniteNum(sym.leftRightDifference)) {
    const diff = sym.leftRightDifference as number;
    const risk = String(sym.lamenessRisk || "").toLowerCase();
    // FEIF: >15% asymmetry = clinical concern; risk label must reflect that
    if (diff > 15 && (risk === "none" || risk === "low")) {
      flags.push({ field: "symmetry.lamenessRisk", value: risk, expected: "moderate/high (diff>15%)", severity: "error", reference: "FEIF / Rhodin 2018" });
    } else { passed++; }
    checked++;
  }

  // Lateral sync vs gait classification (Nicodemus 2003 / Hobbs 2016)
  const gait = String(analysis?.gaitType || "").toLowerCase();
  const latSync = analysis?.lateralSync?.percentage;
  if (isFiniteNum(latSync) && gait) {
    if (gait === "pace" || gait === "andadura") {
      check(latSync >= 90, () => ({ field: "lateralSync", value: latSync, expected: "≥90% for pace", severity: "warning", reference: "Hobbs 2016" }));
    } else if (gait === "trot") {
      check(latSync <= 30, () => ({ field: "lateralSync", value: latSync, expected: "≤30% for trot (diagonal)", severity: "warning", reference: "Hobbs 2016" }));
    } else if (gait === "tölt" || gait === "tolt" || gait === "rack" || gait === "running_walk") {
      check(latSync >= 40 && latSync <= 85, () => ({ field: "lateralSync", value: latSync, expected: "40-85% for 4-beat lateral", severity: "info", reference: "Nicodemus 2003" }));
    }
  }

  // Stance/swing duty cycle (Hobbs 2016: ~50-65% stance at walk/trot)
  const stance = analysis?.kinematicMetrics?.stanceDuration;
  const swing = analysis?.kinematicMetrics?.swingDuration;
  if (stance && swing) {
    for (const leg of ["FL", "FR", "HL", "HR"] as const) {
      const st = stance[leg]; const sw = swing[leg];
      if (isFiniteNum(st) && isFiniteNum(sw) && st > 0 && sw > 0) {
        const duty = st / (st + sw);
        check(duty >= 0.30 && duty <= 0.80, () => ({
          field: `dutyCycle.${leg}`, value: Math.round(duty * 100) / 100, expected: "0.30-0.80", severity: "warning", reference: "Hobbs 2016",
        }));
      }
    }
  }

  // Confidence sanity: if confidence>80 but key metrics missing, flag as inconsistent
  if (isFiniteNum(analysis?.confidence) && (analysis.confidence as number) > 80) {
    const hasKinematics = !!(ja || stance);
    check(hasKinematics, () => ({
      field: "confidence", value: analysis.confidence, expected: "high confidence requires measured kinematics", severity: "warning", reference: "internal sanity",
    }));
  }

  return { flags, passedCount: passed, checkedCount: checked };
}

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

// --- Domain data ---
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
  performance: "המשתמש מעוניין בשיפור ביצועים. התמקד ב-Extension, נקיון הצעד, strideLength, overreach, ואיכות extension.",
  diagnosis: "המשתמש מחפש אבחון בעיה. התמקד ב-stanceDuration asymmetry (>15% = דגל אדום), weakBeat באודיו, legLiftHeight differences.",
  potential: "המשתמש רוצה להעריך פוטנציאל. התייחס לטווח זוויות מפרקים, מקצב טבעי, ומה ניתן לשפר באימון.",
  routine: "מעקב שגרתי. תן סקירה כללית תמציתית עם השוואה למצב תקין.",
};

const FILMING_CONDITIONS: Record<string, string> = {
  arena: "צולם במגרש אילוף — צפה לצעד מבוקר על משטח אחיד.",
  open: "צולם בשטח פתוח — התחשב במשטח לא אחיד, רוח וגירויים חיצוניים.",
  road: "צולם על כביש/אספלט — משטח קשה, שים לב להשפעה על הפרקים.",
  other: "תנאי צילום לא סטנדרטיים — נתח בהתאם למה שנראה בפריימים.",
};

// Combined system prompt: gait analysis + keypoints in single call
const SYSTEM_PROMPT = `אתה מומחה עולמי לביומכניקה של סוסי צעד. בצע שתי משימות בו-זמנית:
1. ניתוח גייט מלא  2. זיהוי keypoints אנטומיים

=== בסיס מחקרי מחייב (יש להיצמד לטווחי ערכים אלה) ===
- Clayton et al. (2013) — טווחי זוויות מפרק תקינים: shoulder 110-130°, elbow 140-165°, carpus 170-180° בעמידה, fetlock 135-160° בעמידה (220-240° בהרחבה). חרוג מטווחים אלו = סמן בעיה ולא להמציא ערכים.
- Hobbs et al. (2016) — חלוקת משקל: ~60% קדמי / 40% אחורי בהילוך וטרוט; אסימטריה >5% = חשד לצליעה. Diagonal dissociation: |Δ|<20ms = טרוט נקי, 20-60ms = פאסי/דייגונל לא מושלם.
- Rhodin et al. (2018) — ולידציית markerless: סימטריית תזוזה אנכית של ראש ואגן היא מדד הצליעה המרכזי. MinDiff/MaxDiff > 6mm לאגן = lameness clinically significant.
- AAEP Lameness Scale 0-5: השתמש לדירוג lamenessRisk (none=0, low=1, moderate=2-3, high=4-5).
- Andersson et al. (2012, Nature) — DMRT3 'gait keeper' mutation: AA→lateral 4-beat (tölt/rack), CC→diagonal 2-beat (trot/canter), CA→גמיש.
- FEI/FEIF beat-evenness threshold: סטיית קצב >10% = "dirty beat"; >15% אסימטריה זמן דריכה = צליעה סמויה.
- Nicodemus & Clayton (2003) — Tölt: lateral footfall sequence HL→FL→HR→FR; שלב תמיכה תמיד ≥1 רגל; אורך צעד 80-120 ס"מ.

כללים מחייבים:
1. אל תחזיר ערך מספרי שאינו תואם לטווח מחקרי ידוע ללא דגל אזהרה (הוסף ל-_warnings).
2. אם אינך יכול למדוד מהפריימים — החזר null, לא ניחוש.
3. כל מסקנה קלינית (צליעה, אסימטריה) חייבת להישען על מדד נמדד, לא על "תחושה ויזואלית".

=== כללי סיווג קריטיים ===
- Pace (2-beat lateral): FL+HL בו-זמנית, FR+HR בו-זמנית. Lateral sync >90%.
- Trot (2-beat diagonal): FL+HR בו-זמנית, FR+HL בו-זמנית. Diagonal sync >90%.
- Tölt (4-beat lateral): 4 פגיעות נפרדות, סדר לטרלי: HL→FL→HR→FR. תמיד רגל אחת+ בקרקע.
- Running Walk: 4-beat, הנהון ראש בולט, overreach גדול.
- Fox Trot: diagonal couplet עם slide אחורי.
- Walk (4-beat): איטי, ללא שלב ריחוף.
- אם לא בטוח — סווג "unknown" עם confidence<40. אל תנחש.
- הבדל סימטריה >15% בזמני דריכה = צליעה סמויה.
- DMRT3 AA→lateral. CC→diagonal. CA→גמיש.

=== Keypoints ===
- קואורדינטות x,y מנורמלות 0-1. נקודה מוסתרת = null + confidence=0.
- שמור יחסים אנטומיים: hoof < fetlock < carpus/stifle < shoulder/hip.
- **חשוב לחיסכון בטוקנים**: החזר keypoints רק עבור עד 5 פריימי-מפתח (keyframes) — לא לכל פריים.
  בחר פריימים שמייצגים אירועים חשובים (touchdown/liftoff של רגליים שונות) או פרוסים אחיד לאורך הסרטון.
  בנוסף החזר סיכום אגרגטיבי בלבד (summary) — ללא פירוט per-frame לכל הפריימים.

=== מבנה JSON (ללא markdown) ===
{
  "analysis": {
    "gaitType": "pace"|"trot"|"tölt"|"running_walk"|"fox_trot"|"paso_fino"|"paso_largo"|"paso_corto"|"marcha_batida"|"marcha_picada"|"andadura"|"unknown",
    "gaitTypeHebrew": "", "confidence": 0-100,
    "beatPattern": "2-beat"|"4-beat"|"4-beat-lateral"|"4-beat-diagonal"|"unknown",
    "lateralSync": {"percentage": 0-100, "description": ""},
    "symmetry": {"score": 0-100, "leftRightDifference": 0-15, "lamenessRisk": "none"|"low"|"moderate"|"high", "lamenessDescription": ""},
    "extension": {"frontLegs": 0-180, "hindLegs": 0-180, "quality": "poor"|"fair"|"good"|"excellent", "description": ""},
    "keypoints": {"detected": true},
    "beatTracker": {"impactTimes": [{"leg":"FL"|"FR"|"HL"|"HR","frameIndex":0,"phase":"stance"|"swing"}], "offsetPercentage": 0-100, "isDirty": false, "dirtyDescription": ""},
    "kinematicMetrics": {"strideLength": {"left": 0, "right": 0, "asymmetryPercent": 0}, "stanceDuration": {"FL":0,"FR":0,"HL":0,"HR":0}, "swingDuration": {"FL":0,"FR":0,"HL":0,"HR":0}, "jointAngles": {"frontLeft":{"shoulder":0,"carpus":0,"fetlock":0},"frontRight":{"shoulder":0,"carpus":0,"fetlock":0},"hindLeft":{"hip":0,"stifle":0,"fetlock":0},"hindRight":{"hip":0,"stifle":0,"fetlock":0}}, "legLiftHeight": {"FL":0,"FR":0,"HL":0,"HR":0}, "overreachDistance": null},
    "suspensionAnalysis": {"FL":{"airTimeMs":0,"groundTimeMs":0,"ratio":0},"FR":{"airTimeMs":0,"groundTimeMs":0,"ratio":0},"HL":{"airTimeMs":0,"groundTimeMs":0,"ratio":0},"HR":{"airTimeMs":0,"groundTimeMs":0,"ratio":0},"asymmetryAlerts":[]},
    "overallScore": 0-100, "calibration": {"referenceObject":"none","pixelsPerCm":null,"confidence":0,"calibrationMethod":""},
    "trainingRecommendations": [], "summary": "", "breedSpecificNotes": null, "goalFocusedSummary": null
  },
  "detailedKeypoints": {
    "schemaVersion": 2,
    "keyframes": [{"frameIndex":0,"event":"touchdown_FL"|"liftoff_HR"|"sample","frontLeft":{"hoof":[0,0],"fetlock":[0,0]},"frontRight":{"hoof":[0,0],"fetlock":[0,0]},"hindLeft":{"hoof":[0,0],"fetlock":[0,0]},"hindRight":{"hoof":[0,0],"fetlock":[0,0]},"body":{"withers":[0,0],"dock":[0,0]},"avgConfidence":0}],
    "summary": {"totalFramesAnalyzed":0,"keyframesReturned":0,"meanConfidence":0,"description":""},
    "calibration": {"estimatedHeightPx":0,"pixelsPerCm":0,"confidence":0},
    "perKeypointVisibility": {"lf_hoof":{"mean":0,"occludedPct":0},"rf_hoof":{"mean":0,"occludedPct":0},"lh_hoof":{"mean":0,"occludedPct":0},"rh_hoof":{"mean":0,"occludedPct":0}},
    "occlusionNotes": []
  }
}

החזר JSON בלבד. הגבל keyframes ל-5 פריימים מקסימום.`;

// --- Main handler ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  // --- JWT Auth Check ---
  const authHeader = req.headers.get("Authorization");
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
    const { frames, dmrt3Genotype, horseName, breedId, trainingLevel, analysisGoal, filmingCondition, notes, horseHeightCm, audioMetrics: inputAudio, calibrationData, primaryGoal, targetStyle, primaryUse, outputPreference, additionalInfo, fps, forecastHorizonSec, automaticSources } = await req.json();
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

    // Build dynamic context
    const contextParts: string[] = [];
    if (horseName) contextParts.push(`שם הסוס: ${horseName}`);
    if (horseHeightCm) contextParts.push(`גובה הסוס: ${horseHeightCm} ס"מ. השתמש לכיול מדדים מרחביים.`);
    if (dmrt3Genotype) contextParts.push(`גנוטיפ DMRT3: ${dmrt3Genotype}.`);
    if (breedId && BREED_DATA[breedId]) {
      const breed = BREED_DATA[breedId];
      contextParts.push(`גזע: ${breed.nameHe} (${breed.nameEn})\nצעדים: ${breed.gaits.join(", ")}\nDMRT3: ${breed.dmrt3}\nמאפיינים: ${breed.characteristics.join(", ")}\nנורמות: ${breed.norms}`);
    }
    if (trainingLevel && TRAINING_LEVELS[trainingLevel]) contextParts.push(TRAINING_LEVELS[trainingLevel]);
    if (analysisGoal && GOAL_FOCUS[analysisGoal]) contextParts.push(`מטרה: ${GOAL_FOCUS[analysisGoal]}`);
    if (filmingCondition && FILMING_CONDITIONS[filmingCondition]) contextParts.push(FILMING_CONDITIONS[filmingCondition]);
    if (notes) contextParts.push(`הערות: ${notes}`);
    if (primaryGoal) {
      const goalMap: Record<string, string> = {
        "structure-match": "התאמת מבנה לגזע", "performance": "שיפור ביצועים",
        "risk-detection": "זיהוי מגבלות/סיכונים", "general": "הערכה כללית",
      };
      contextParts.push(`מטרת הניתוח (מהשאלון): ${goalMap[primaryGoal] || primaryGoal}`);
    }
    if (targetStyle) contextParts.push(`סגנון יעד: ${targetStyle}`);
    if (primaryUse) contextParts.push(`שימוש: ${primaryUse}`);
    if (outputPreference?.includes("short")) contextParts.push("העדפת פלט: קצר. summary 2-3 משפטים. trainingRecommendations מוגבל ל-3.");
    if (additionalInfo) contextParts.push(`מידע נוסף: ${additionalInfo}`);
    if (calibrationData) {
      contextParts.push(`כיול: סמן=${calibrationData.markerType}, ${calibrationData.referenceLength ? `אורך=${calibrationData.referenceLength}cm` : ""}, ביטחון=${calibrationData.confidence}%`);
    }
    if (audioMetrics) {
      contextParts.push(`אודיו: BPM=${audioMetrics.bpm}, סדירות=${audioMetrics.regularity}%, נקישות=${audioMetrics.beatCount}, נקישה_חלשה=${audioMetrics.hasWeakBeat ? "כן" : "לא"}${audioMetrics.dragNoiseDetected ? ", גרירה=כן" : ""}`);
    }

    // Build user content
    const userContent: any[] = [];
    if (contextParts.length > 0) {
      userContent.push({ type: "text", text: `הקשר:\n${contextParts.join("\n")}` });
    }
    userContent.push({
      type: "text",
      text: `נתח ${validFrames.length} פריימים. בצע בו-זמנית: (1) ניתוח גייט מלא (2) זיהוי keypoints אנטומיים לכל פריים. החזר JSON מאוחד בדיוק לפי המבנה בהנחיות.`,
    });

    // Frame normalization + downsampling
    const MAX_FRAMES = Number(Deno.env.get("MAX_FRAMES") || 10);
    const selectedFrames = downsampleFrames(validFrames, MAX_FRAMES).map((f: string) => normalizeFrameToDataUrl(String(f)));

    for (const frame of selectedFrames) {
      userContent.push({ type: "image_url", image_url: { url: frame } });
    }

    // Configurable AI endpoint/model
    const LOVABLE_ENDPOINT = Deno.env.get("LOVABLE_ENDPOINT") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const LOVABLE_MODEL = Deno.env.get("LOVABLE_MODEL") || "google/gemini-2.5-flash-lite";

    const gatewayController = new AbortController();
    const gatewayTimeout = setTimeout(() => gatewayController.abort(), GATEWAY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(LOVABLE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: LOVABLE_MODEL,
          max_tokens: 16000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT + (automaticSources ? AUTO_SOURCE_PROMPT : "") },
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
      const status = response.status;
      if (status === 429) return jsonResponse({ error: "חריגה ממגבלת בקשות. נסו שוב בעוד דקה." }, { status: 429 });
      if (status === 402) return jsonResponse({ error: "נדרשת הוספת קרדיטים." }, { status: 402 });
      const errText = await response.text();
      console.error("AI gateway error:", status, errText);
      return jsonResponse({ error: "שגיאה בשירות הניתוח" }, { status: 500 });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const finishReason = data.choices?.[0]?.finish_reason;

    if (!rawContent) {
      return jsonResponse({ error: "לא התקבלה תשובה מה-AI." }, { status: 500 });
    }

    // Robust JSON parsing with truncation handling
    let parsed;
    const wasTruncated = finishReason === "length" || finishReason === "MAX_TOKENS";
    try {
      const jsonMatch = extractJsonObject(String(rawContent));
      let jsonStr = jsonMatch ? jsonMatch : String(rawContent);
      if (wasTruncated) {
        console.warn("AI response was truncated, attempting safe repair");
        jsonStr = repairTruncatedJson(jsonStr);
      }
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Fallback: attempt repair even if not flagged as truncated
        console.warn("Initial JSON.parse failed, attempting repair fallback");
        parsed = JSON.parse(repairTruncatedJson(jsonStr));
      }
    } catch {
      console.error("Failed to parse combined AI response:", String(rawContent).substring(0, 800));
      return jsonResponse({ error: "תשובת הניתוח נחתכה ולא ניתן לעבד אותה. נסו סרטון קצר יותר." }, { status: 502 });
    }

    // Normalize: ensure both parts exist
    const analysis = parsed.analysis || parsed;
    let detailedKeypoints = parsed.detailedKeypoints || null;

    // Safeguard: if AI returned legacy `keypoints` array, downsample to ≤5 keyframes
    if (detailedKeypoints && Array.isArray(detailedKeypoints.keypoints) && !detailedKeypoints.keyframes) {
      const all = detailedKeypoints.keypoints;
      const MAX_KF = 5;
      const step = Math.max(1, Math.ceil(all.length / MAX_KF));
      const sampled = [];
      for (let i = 0; i < all.length && sampled.length < MAX_KF; i += step) sampled.push(all[i]);
      detailedKeypoints.keyframes = sampled.map((kp: any) => ({ ...kp, event: "sample" }));
      detailedKeypoints.summary = detailedKeypoints.summary || {
        totalFramesAnalyzed: all.length,
        keyframesReturned: sampled.length,
        meanConfidence: 0,
        description: "Downsampled server-side from per-frame keypoints.",
      };
      delete detailedKeypoints.keypoints;
    }

    // Mark truncated results
    if (wasTruncated) {
      analysis._truncated = true;
      analysis._warnings = [...(analysis._warnings || []), "AI response was truncated — some results may be incomplete."];
    }

    // --- Motion Forecast (non-breaking add-on) ---
    const requestedFps = Number(fps) > 0 && Number.isFinite(Number(fps)) ? Number(fps) : 30;
    const forecastHorizon = Number(forecastHorizonSec) > 0 && Number.isFinite(Number(forecastHorizonSec)) ? Number(forecastHorizonSec) : 2.0;
    analysis.motionForecast = predictMotionForecast(analysis, { fps: requestedFps, horizonSec: forecastHorizon, audioMetrics });

    // Sanity defaults
    if (!analysis.calibration) {
      analysis.calibration = { referenceObject: "none", pixelsPerCm: null, confidence: 0, calibrationMethod: "" };
    }
    if (audioMetrics && !analysis.audioAnalysis) {
      analysis.audioAnalysis = { detectedBPM: audioMetrics.bpm ?? null, rhythmRegularity: audioMetrics.regularity ?? null, beatPattern: null, weakBeatDetected: audioMetrics.hasWeakBeat ?? null, audioGaitClassification: null, audioConfidence: 0 };
    }
    if (audioMetrics && !analysis.multiModalFusion) {
      analysis.multiModalFusion = { visionGaitType: analysis.gaitType || "", audioGaitType: null, agreement: true, conflictDescription: "", fusedConfidence: 0, dominantModality: "vision" };
    }

    // Server-side fusedConfidence validation
    if (analysis.multiModalFusion && audioMetrics) {
      const vConf = typeof analysis.confidence === "number" ? analysis.confidence / 100 : 0.5;
      const aConf = typeof analysis.audioAnalysis?.audioConfidence === "number" ? analysis.audioAnalysis.audioConfidence / 100 : 0.3;
      let expectedFused = vConf * 0.6 + aConf * 0.4;
      if (analysis.multiModalFusion.agreement === false) expectedFused = Math.max(0, expectedFused - 0.20);
      expectedFused = Math.round(clamp01(expectedFused) * 100);
      analysis.multiModalFusion._serverExpectedFusedConfidence = expectedFused;
      analysis.multiModalFusion._serverValidated = true;
      const aiFused = analysis.multiModalFusion.fusedConfidence ?? 0;
      if (Math.abs(aiFused - expectedFused) > 30) {
        analysis.multiModalFusion._fusedConfidenceOverridden = true;
        analysis.multiModalFusion.fusedConfidence = expectedFused;
      }
    }

    // --- Scientific validation: cross-check AI output against published norms ---
    try {
      const { flags, passedCount, checkedCount } = validateAgainstResearch(analysis);
      analysis._researchValidation = {
        checkedCount,
        passedCount,
        passRate: checkedCount > 0 ? Math.round((passedCount / checkedCount) * 100) : null,
        flags,
        references: [
          "Clayton HM et al. (2013) — Equine joint kinematics norms",
          "Hobbs SJ et al. (2016) — Ground reaction forces & limb loading",
          "Rhodin M et al. (2018) — Markerless symmetry validation",
          "Andersson LS et al. (2012, Nature) — DMRT3 gait keeper",
          "Nicodemus & Clayton (2003) — Tölt footfall sequencing",
          "AAEP Lameness Scale 0-5; FEIF beat-evenness threshold",
        ],
      };
      // If many flags, demote confidence by 10 points (capped) to reflect uncertainty
      const errorFlags = flags.filter(f => f.severity === "error").length;
      if (errorFlags > 0 && isFiniteNum(analysis.confidence)) {
        analysis.confidence = Math.max(0, (analysis.confidence as number) - 10 * Math.min(3, errorFlags));
        analysis._warnings = [...(analysis._warnings || []), `Confidence reduced due to ${errorFlags} research-norm violation(s).`];
      }
    } catch (vErr) {
      console.warn("Research validator failed:", vErr);
    }

    if (automaticSources) {
      applyAutomaticSources(analysis, audioMetrics);
      if (!analysis.sourceSelection.visionUsed) detailedKeypoints = null;
    }
    return jsonResponse({ analysis, detailedKeypoints });
  } catch (e) {
    console.error("gait-vision-combined error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }, { status: 500 });
  }
});
