import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Geometric helpers =====

function distance(a: [number, number] | null, b: [number, number] | null): number | null {
  if (!a || !b) return null;
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function angleBetween(a: [number, number] | null, b: [number, number] | null, c: [number, number] | null): number | null {
  if (!a || !b || !c) return null;
  const ba = [a[0] - b[0], a[1] - b[1]];
  const bc = [c[0] - b[0], c[1] - b[1]];
  const dot = ba[0] * bc[0] + ba[1] * bc[1];
  const magBA = Math.sqrt(ba[0] ** 2 + ba[1] ** 2);
  const magBC = Math.sqrt(bc[0] ** 2 + bc[1] ** 2);
  if (magBA === 0 || magBC === 0) return null;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// ===== Existing kinematic computations =====

function computeJointAngles(kp: any) {
  const result: any = {};
  if (kp.frontLeft) {
    result.frontLeft = {
      shoulder: angleBetween(kp.body?.withers || null, kp.frontLeft.shoulder, kp.frontLeft.carpus),
      carpus: angleBetween(kp.frontLeft.shoulder, kp.frontLeft.carpus, kp.frontLeft.fetlock),
      fetlock: angleBetween(kp.frontLeft.carpus, kp.frontLeft.fetlock, kp.frontLeft.hoof),
    };
  }
  if (kp.frontRight) {
    result.frontRight = {
      shoulder: angleBetween(kp.body?.withers || null, kp.frontRight.shoulder, kp.frontRight.carpus),
      carpus: angleBetween(kp.frontRight.shoulder, kp.frontRight.carpus, kp.frontRight.fetlock),
      fetlock: angleBetween(kp.frontRight.carpus, kp.frontRight.fetlock, kp.frontRight.hoof),
    };
  }
  if (kp.hindLeft) {
    result.hindLeft = {
      hip: angleBetween(kp.body?.dock || null, kp.hindLeft.hip, kp.hindLeft.stifle),
      stifle: angleBetween(kp.hindLeft.hip, kp.hindLeft.stifle, kp.hindLeft.fetlock),
      fetlock: angleBetween(kp.hindLeft.stifle, kp.hindLeft.fetlock, kp.hindLeft.hoof),
    };
  }
  if (kp.hindRight) {
    result.hindRight = {
      hip: angleBetween(kp.body?.dock || null, kp.hindRight.hip, kp.hindRight.stifle),
      stifle: angleBetween(kp.hindRight.hip, kp.hindRight.stifle, kp.hindRight.fetlock),
      fetlock: angleBetween(kp.hindRight.stifle, kp.hindRight.fetlock, kp.hindRight.hoof),
    };
  }
  return result;
}

function computeLegLiftHeight(keypoints: any[]): any {
  const legs = ["frontLeft", "frontRight", "hindLeft", "hindRight"];
  const abbr = ["FL", "FR", "HL", "HR"];
  const result: any = {};
  for (let i = 0; i < legs.length; i++) {
    let maxLift = 0;
    let groundY = 0;
    for (const kp of keypoints) {
      const leg = kp[legs[i]];
      if (!leg?.hoof) continue;
      groundY = Math.max(groundY, leg.hoof[1]);
    }
    for (const kp of keypoints) {
      const leg = kp[legs[i]];
      if (!leg?.hoof) continue;
      const lift = groundY - leg.hoof[1];
      maxLift = Math.max(maxLift, lift);
    }
    result[abbr[i]] = Math.round(maxLift * 1000) / 1000;
  }
  return result;
}

function computeSuspension(keypoints: any[], fps: number): any {
  const legs = ["frontLeft", "frontRight", "hindLeft", "hindRight"];
  const abbr = ["FL", "FR", "HL", "HR"];
  const result: any = {};
  const frameDuration = 1000 / fps;
  for (let i = 0; i < legs.length; i++) {
    let groundFrames = 0;
    let airFrames = 0;
    let groundY = 0;
    for (const kp of keypoints) {
      const leg = kp[legs[i]];
      if (leg?.hoof) groundY = Math.max(groundY, leg.hoof[1]);
    }
    const threshold = 0.02;
    for (const kp of keypoints) {
      const leg = kp[legs[i]];
      if (!leg?.hoof) continue;
      if (groundY - leg.hoof[1] > threshold) airFrames++;
      else groundFrames++;
    }
    const total = airFrames + groundFrames;
    if (total > 0) {
      result[abbr[i]] = {
        airTimeMs: Math.round(airFrames * frameDuration),
        groundTimeMs: Math.round(groundFrames * frameDuration),
        ratio: Math.round((airFrames / total) * 1000) / 1000,
      };
    }
  }
  const alerts: string[] = [];
  if (result.FL && result.FR && Math.abs(result.FL.ratio - result.FR.ratio) > 0.05)
    alerts.push("אסימטריה ב-suspension בין רגליים קדמיות");
  if (result.HL && result.HR && Math.abs(result.HL.ratio - result.HR.ratio) > 0.05)
    alerts.push("אסימטריה ב-suspension בין רגליים אחוריות");
  result.asymmetryAlerts = alerts;
  return result;
}

// ===== FEIF Scores (deterministic) =====

const FEIF_THRESHOLDS = {
  beatClarity: { excellent: 0.9, good: 0.75, fair: 0.6 },
  tempoConsistency: { excellent: 0.85, good: 0.7, fair: 0.55 },
};

function computeFEIFScores(gaitType: string | undefined, syncScore: number | undefined, consistencyScore: number | undefined, bpm: number | undefined) {
  if (syncScore == null && consistencyScore == null) return undefined;
  const sync = (syncScore ?? 70) / 100;
  const cons = (consistencyScore ?? 70) / 100;
  const beatClarity = Math.round(sync * 10) / 10;
  const tempoConsistency = Math.round(cons * 10) / 10;
  let slowToltQuality: number | null = null;
  let fastToltQuality: number | null = null;
  let paceQuality: number | null = null;
  const gt = (gaitType || "").toLowerCase();
  if (gt.includes("tolt") || gt.includes("tölt")) {
    slowToltQuality = Math.round(((sync * 0.6 + cons * 0.4) * 10) * 10) / 10;
    fastToltQuality = Math.round(((sync * 0.5 + cons * 0.5) * 10) * 10) / 10;
  }
  if (gt.includes("pace")) {
    paceQuality = Math.round(((sync * 0.7 + cons * 0.3) * 10) * 10) / 10;
  }
  const avgScore = (beatClarity + tempoConsistency) / 2;
  let level = "beginner";
  let ready = false;
  if (avgScore >= 0.85) { level = "competition"; ready = true; }
  else if (avgScore >= 0.7) { level = "advanced_training"; ready = false; }
  else if (avgScore >= 0.55) { level = "intermediate_training"; ready = false; }
  const warnings: string[] = [];
  if (beatClarity < FEIF_THRESHOLDS.beatClarity.fair) warnings.push("בהירות הביט נמוכה — יש לשפר נקיון הצעד");
  if (tempoConsistency < FEIF_THRESHOLDS.tempoConsistency.fair) warnings.push("עקביות הקצב נמוכה — נדרש אימון ריתמי");
  if (bpm && bpm > 160) warnings.push("BPM גבוה מאוד — ייתכן שהסוס בלחץ");
  return { beatClarity, tempoConsistency, slowToltQuality, fastToltQuality, paceQuality, competitionReadiness: { ready, level, description: ready ? "מוכן לתחרות" : `רמה: ${level}` }, warnings };
}

// ===== Froude Number =====

function computeFroudeNumber(speedKmh: number | undefined, horseHeightCm: number | undefined) {
  if (!speedKmh || !horseHeightCm) return undefined;
  const v = speedKmh / 3.6;
  const legLength = (horseHeightCm / 100) * 0.55;
  const g = 9.81;
  const fr = (v * v) / (g * legLength);
  const value = Math.round(fr * 1000) / 1000;
  let interpretation: string;
  let gaitZone: "walk" | "trot" | "gallop" | "transition";
  if (fr < 0.5) { interpretation = "אזור הליכה — יעילות אנרגטית גבוהה"; gaitZone = "walk"; }
  else if (fr < 1.0) { interpretation = "מעבר הליכה-ריצה קלה"; gaitZone = "transition"; }
  else if (fr < 2.5) { interpretation = "אזור ריצה קלה (trot)"; gaitZone = "trot"; }
  else { interpretation = "אזור דהירה (gallop) — עומס גבוה על מפרקים"; gaitZone = "gallop"; }
  return { value, interpretation, gaitZone };
}

// ===== HHO & Lameness Grade =====

function computeHHOAndLamenessGrade(asymmetryPercent: number) {
  const hhoEstimate = Math.round(asymmetryPercent * 0.8 * 100) / 100;
  let lamenessGrade: number;
  let aaepScale: string;
  if (hhoEstimate < 2) { lamenessGrade = 0; aaepScale = "0 — ללא צליעה נראית"; }
  else if (hhoEstimate < 5) { lamenessGrade = 1; aaepScale = "1 — צליעה קשה לזיהוי, לא עקבית"; }
  else if (hhoEstimate < 10) { lamenessGrade = 2; aaepScale = "2 — צליעה קשה לזיהוי בהליכה, נראית בריצה קלה"; }
  else if (hhoEstimate < 20) { lamenessGrade = 3; aaepScale = "3 — צליעה נראית בעקביות בריצה קלה"; }
  else if (hhoEstimate < 35) { lamenessGrade = 4; aaepScale = "4 — צליעה ברורה, הנהון ראש ניכר"; }
  else { lamenessGrade = 5; aaepScale = "5 — צליעה חמורה — הסוס כמעט לא נושא משקל"; }
  return { hhoEstimate, lamenessGrade, aaepScale, disclaimer: "הערכה אלגוריתמית בלבד. אינה מחליפה בדיקה וטרינרית קלינית. HHO מדויק דורש מדידת תנועת ראש ישירה." };
}

// ===== FEI Standards =====

function computeFEIStandards(bpm: number | undefined, consistencyScore: number | undefined) {
  const bpmVal = bpm ?? 0;
  const cons = (consistencyScore ?? 50) / 100;
  const withinLimits = bpmVal > 0 && bpmVal <= 64;
  const enduranceScore = Math.round((cons * 70 + (withinLimits ? 30 : 0)) * 10) / 10;
  let level: string;
  if (enduranceScore >= 85) level = "מוכן לסיבולת";
  else if (enduranceScore >= 65) level = "מתקדם";
  else if (enduranceScore >= 45) level = "בינוני";
  else level = "דורש שיפור";
  return {
    recoveryHeartRate: { estimated: true, withinLimits, description: withinLimits ? "דופק התאוששות בגבולות תקן FEI (≤64 BPM)" : bpmVal > 0 ? "דופק התאוששות חורג מתקן FEI" : "לא ניתן להעריך — אין נתוני BPM" },
    enduranceReadiness: { score: enduranceScore, level, description: `רמת מוכנות סיבולת: ${level}` },
  };
}

// ===== Overall Performance =====

function computeOverallPerformance(syncScore: number | undefined, consistencyScore: number | undefined, symmetryScore: number | undefined, beatClarity: number | undefined) {
  const sync = syncScore ?? 50;
  const cons = consistencyScore ?? 50;
  const sym = symmetryScore ?? 50;
  const beat = (beatClarity ?? 0.5) * 100;
  const score = Math.round(sync * 0.3 + cons * 0.25 + sym * 0.25 + beat * 0.2);
  let level: "elite" | "advanced" | "intermediate" | "developing" | "beginner";
  if (score >= 90) level = "elite";
  else if (score >= 75) level = "advanced";
  else if (score >= 60) level = "intermediate";
  else if (score >= 40) level = "developing";
  else level = "beginner";
  return { score, level, breakdown: { sync, consistency: cons, symmetry: sym, beatClarity: beat } };
}

// ===== NEW: Biomechanics computations =====

function isFinite2(p: any): p is [number, number] {
  return Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

function meanArr(arr: number[]): number | undefined {
  const a = arr.filter(Number.isFinite);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : undefined;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Extract hoof Y values across keypoints for a given leg */
function hoofYSeries(keypoints: any[], legName: string): (number | undefined)[] {
  return keypoints.map((kp: any) => {
    const leg = kp[legName];
    return leg?.hoof && isFinite2(leg.hoof) ? leg.hoof[1] : undefined;
  });
}

/** Detect touchdown frame indices from hoof Y series */
function detectTouchdownFrames(yValues: (number | undefined)[]): number[] {
  const defined = yValues.filter((v): v is number => v !== undefined);
  if (defined.length < 3) return [];
  const maxY = Math.max(...defined);
  const minY = Math.min(...defined);
  const range = maxY - minY;
  if (range < 0.005) return [];
  const threshold = maxY - range * 0.15;
  const touchdowns: number[] = [];
  let wasGrounded = yValues[0] !== undefined && yValues[0] >= threshold;
  for (let i = 1; i < yValues.length; i++) {
    const y = yValues[i];
    if (y === undefined) continue;
    const isGrounded = y >= threshold;
    if (!isGrounded && wasGrounded) { /* liftoff, skip */ }
    else if (isGrounded && !wasGrounded) { touchdowns.push(i); }
    wasGrounded = isGrounded;
  }
  return touchdowns;
}

function computeBiomechPhaseLags(keypoints: any[], fps: number) {
  const dt = 1 / fps;
  const legs: Record<string, string> = {
    lf: "frontLeft", rf: "frontRight", lh: "hindLeft", rh: "hindRight"
  };
  const tdTimes: Record<string, number[]> = {};
  for (const [abbr, legName] of Object.entries(legs)) {
    const ySeries = hoofYSeries(keypoints, legName);
    const frames = detectTouchdownFrames(ySeries);
    tdTimes[abbr] = frames.map(f => f * dt);
  }

  function avgLag(a: string, b: string): number | undefined {
    const ta = tdTimes[a];
    const tb = tdTimes[b];
    if (!ta?.length || !tb?.length) return undefined;
    const lags: number[] = [];
    for (const tA of ta) {
      let minDiff = Infinity;
      for (const tB of tb) { minDiff = Math.min(minDiff, Math.abs(tB - tA)); }
      if (Number.isFinite(minDiff)) lags.push(minDiff * 1000);
    }
    return meanArr(lags);
  }

  const lf_rh = avgLag("lf", "rh");
  const rf_lh = avgLag("rf", "lh");
  const lf_lh = avgLag("lf", "lh");
  const rf_rh = avgLag("rf", "rh");

  if (lf_rh === undefined && rf_lh === undefined && lf_lh === undefined && rf_rh === undefined) return undefined;

  return {
    lf_rh: lf_rh !== undefined ? Math.round(lf_rh * 10) / 10 : undefined,
    rf_lh: rf_lh !== undefined ? Math.round(rf_lh * 10) / 10 : undefined,
    lf_lh: lf_lh !== undefined ? Math.round(lf_lh * 10) / 10 : undefined,
    rf_rh: rf_rh !== undefined ? Math.round(rf_rh * 10) / 10 : undefined,
  };
}

function computeBiomechDiagDissociation(keypoints: any[], fps: number) {
  const dt = 1 / fps;
  const lfY = hoofYSeries(keypoints, "frontLeft");
  const rhY = hoofYSeries(keypoints, "hindRight");
  const rfY = hoofYSeries(keypoints, "frontRight");
  const lhY = hoofYSeries(keypoints, "hindLeft");

  function diagDissoc(frontY: (number | undefined)[], hindY: (number | undefined)[]): number | undefined {
    const fTds = detectTouchdownFrames(frontY).map(f => f * dt);
    const hTds = detectTouchdownFrames(hindY).map(f => f * dt);
    if (!fTds.length || !hTds.length) return undefined;
    const diffs: number[] = [];
    for (const ft of fTds) {
      let closest = Infinity;
      for (const ht of hTds) { closest = Math.min(closest, Math.abs(ht - ft)); }
      if (Number.isFinite(closest)) diffs.push(closest * 1000);
    }
    return meanArr(diffs);
  }

  const lf_rh = diagDissoc(lfY, rhY);
  const rf_lh = diagDissoc(rfY, lhY);
  if (lf_rh === undefined && rf_lh === undefined) return undefined;
  return {
    lf_rh: lf_rh !== undefined ? Math.round(lf_rh * 10) / 10 : undefined,
    rf_lh: rf_lh !== undefined ? Math.round(rf_lh * 10) / 10 : undefined,
  };
}

function computeHeadPelvisVertical(keypoints: any[]) {
  const headY: number[] = [];
  const pelvisY: number[] = [];
  for (const kp of keypoints) {
    const poll = kp.body?.poll;
    const dock = kp.body?.dock;
    if (isFinite2(poll)) headY.push(poll[1]);
    if (isFinite2(dock)) pelvisY.push(dock[1]);
  }

  const headVerticalROM = headY.length >= 2 ? Math.round((Math.max(...headY) - Math.min(...headY)) * 10000) / 10000 : undefined;
  const pelvisVerticalROM = pelvisY.length >= 2 ? Math.round((Math.max(...pelvisY) - Math.min(...pelvisY)) * 10000) / 10000 : undefined;

  let headVerticalAsymmetryIndex: number | undefined;
  if (headY.length >= 4) {
    const m = meanArr(headY)!;
    const ups = headY.filter(v => v < m).map(v => m - v);
    const downs = headY.filter(v => v > m).map(v => v - m);
    const upMean = meanArr(ups) ?? 0;
    const downMean = meanArr(downs) ?? 0;
    const denom = Math.max(upMean, downMean, 0.001);
    headVerticalAsymmetryIndex = Math.round((Math.abs(upMean - downMean) / denom) * 1000) / 1000;
  }

  let headPelvisPhaseLagMs: number | undefined;
  if (headY.length >= 3 && pelvisY.length >= 3 && keypoints.length >= 3) {
    // Simple: find frame of min Y for head and pelvis
    let headMinIdx = 0; let pelvisMinIdx = 0;
    let headMin = Infinity; let pelvisMin = Infinity;
    let hi = 0; let pi = 0;
    for (let i = 0; i < keypoints.length; i++) {
      const poll = keypoints[i].body?.poll;
      const dock = keypoints[i].body?.dock;
      if (isFinite2(poll) && poll[1] < headMin) { headMin = poll[1]; headMinIdx = hi; }
      if (isFinite2(poll)) hi++;
      if (isFinite2(dock) && dock[1] < pelvisMin) { pelvisMin = dock[1]; pelvisMinIdx = pi; }
      if (isFinite2(dock)) pi++;
    }
    // Approximate dt
    const totalDuration = keypoints.length > 1 ? (keypoints.length - 1) / 30 : 0; // assume 30fps default
    const dt = totalDuration / Math.max(keypoints.length - 1, 1);
    headPelvisPhaseLagMs = Math.round(Math.abs(headMinIdx - pelvisMinIdx) * dt * 1000 * 10) / 10;
  }

  return { headVerticalROM, pelvisVerticalROM, headPelvisPhaseLagMs, headVerticalAsymmetryIndex };
}

function computeBackKinematics(keypoints: any[]) {
  const withersY: number[] = [];
  const dockY: number[] = [];
  const slopes: number[] = [];
  const dockX: number[] = [];

  for (const kp of keypoints) {
    const w = kp.body?.withers;
    const d = kp.body?.dock;
    if (isFinite2(w)) withersY.push(w[1]);
    if (isFinite2(d)) { dockY.push(d[1]); dockX.push(d[0]); }
    if (isFinite2(w) && isFinite2(d)) {
      const dx = d[0] - w[0];
      const dy = d[1] - w[1];
      if (Math.abs(dx) > 0.001) slopes.push(Math.atan2(dy, dx) * (180 / Math.PI));
    }
  }

  const wROM = withersY.length >= 2 ? Math.max(...withersY) - Math.min(...withersY) : undefined;
  const dROM = dockY.length >= 2 ? Math.max(...dockY) - Math.min(...dockY) : undefined;
  const withersCroupROM = wROM !== undefined && dROM !== undefined ? Math.round(Math.abs(wROM - dROM) * 10000) / 10000 : undefined;
  const backSlopeROM = slopes.length >= 2 ? Math.round((Math.max(...slopes) - Math.min(...slopes)) * 100) / 100 : undefined;
  const lateralSwayIndex = dockX.length >= 2 ? Math.round((Math.max(...dockX) - Math.min(...dockX)) * 10000) / 10000 : undefined;

  return { withersCroupROM, backSlopeROM, lateralSwayIndex };
}

function computeGaitClassificationFromLags(phaseLags: any, fps: number) {
  if (!phaseLags) return { classification: "unknown", confidence: 0 };
  const diagAvg = meanArr([phaseLags.lf_rh, phaseLags.rf_lh].filter((v: any): v is number => v !== undefined));
  const latAvg = meanArr([phaseLags.lf_lh, phaseLags.rf_rh].filter((v: any): v is number => v !== undefined));
  if (diagAvg === undefined && latAvg === undefined) return { classification: "unknown", confidence: 0 };

  const frameDurMs = 1000 / fps;
  const nearZero = frameDurMs * 1.5;
  const dVal = diagAvg ?? Infinity;
  const lVal = latAvg ?? Infinity;

  let classification: string;
  let confidence: number;
  if (dVal < nearZero && lVal > nearZero * 2) { classification = "diagonal"; confidence = clamp01(1 - dVal / (nearZero * 3)); }
  else if (lVal < nearZero && dVal > nearZero * 2) { classification = "lateral"; confidence = clamp01(1 - lVal / (nearZero * 3)); }
  else if (dVal > nearZero && lVal > nearZero) { classification = "four_beat"; confidence = clamp01(Math.min(dVal, lVal) / (nearZero * 3)); }
  else { classification = "unknown"; confidence = 0.2; }

  return { classification, confidence: Math.round(confidence * 100) / 100 };
}

// ===== Main handler =====

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const {
      keypoints, calibration, horseHeightCm, fps = 30,
      gaitType, syncScore, bpm, consistencyScore, speedKmh,
    } = await req.json();

    if (!keypoints || !Array.isArray(keypoints) || keypoints.length === 0) {
      return new Response(JSON.stringify({ error: "נדרשים נתוני keypoints" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pxPerCm = calibration?.pixelsPerCm || (horseHeightCm ? 1 : null);

    // Joint angles from first detected frame
    const jointAngles = computeJointAngles(keypoints[0]);
    const legLiftHeight = computeLegLiftHeight(keypoints);
    const suspensionAnalysis = computeSuspension(keypoints, fps);

    // Stride length
    let strideLengthLeft: number | null = null;
    let strideLengthRight: number | null = null;
    const flHoofs = keypoints.map((kp: any) => kp.frontLeft?.hoof).filter(Boolean);
    const frHoofs = keypoints.map((kp: any) => kp.frontRight?.hoof).filter(Boolean);
    if (flHoofs.length >= 2) {
      strideLengthLeft = distance(flHoofs[0], flHoofs[flHoofs.length - 1]);
      if (strideLengthLeft && pxPerCm) strideLengthLeft = Math.round(strideLengthLeft / pxPerCm * 100) / 100;
    }
    if (frHoofs.length >= 2) {
      strideLengthRight = distance(frHoofs[0], frHoofs[frHoofs.length - 1]);
      if (strideLengthRight && pxPerCm) strideLengthRight = Math.round(strideLengthRight / pxPerCm * 100) / 100;
    }

    const asymmetryPercent = (strideLengthLeft && strideLengthRight)
      ? Math.round(Math.abs(strideLengthLeft - strideLengthRight) / Math.max(strideLengthLeft, strideLengthRight) * 10000) / 100
      : 0;

    // Overreach
    let overreachDistance: number | null = null;
    const hlHoofs = keypoints.map((kp: any) => kp.hindLeft?.hoof).filter(Boolean);
    if (flHoofs.length > 0 && hlHoofs.length > 0) {
      const frontMinX = Math.min(...flHoofs.map((h: [number, number]) => h[0]));
      const hindMaxX = Math.max(...hlHoofs.map((h: [number, number]) => h[0]));
      overreachDistance = Math.round((hindMaxX - frontMinX) * 1000) / 1000;
    }

    // NEW: Biomechanics computations
    const phaseLagMs = computeBiomechPhaseLags(keypoints, fps);
    const diagonalDissociationMs = computeBiomechDiagDissociation(keypoints, fps);
    const headPelvisMetrics = computeHeadPelvisVertical(keypoints);
    const backMetrics = computeBackKinematics(keypoints);
    const gaitClassification = computeGaitClassificationFromLags(phaseLagMs, fps);

    const kinematicMetrics = {
      strideLength: strideLengthLeft !== null ? { left: strideLengthLeft, right: strideLengthRight || 0, asymmetryPercent } : undefined,
      jointAngles: Object.keys(jointAngles).length > 0 ? jointAngles : undefined,
      legLiftHeight,
      overreachDistance,
      phaseLagMs: phaseLagMs || undefined,
      diagonalDissociationMs: diagonalDissociationMs || undefined,
    };

    // NEW computations
    const feifScores = computeFEIFScores(gaitType, syncScore, consistencyScore, bpm);
    const froudeNumber = computeFroudeNumber(speedKmh, horseHeightCm);
    const lamenessAssessment = computeHHOAndLamenessGrade(asymmetryPercent);
    const feiStandards = computeFEIStandards(bpm, consistencyScore);
    const symmetryScore = 100 - asymmetryPercent;
    const overallPerformance = computeOverallPerformance(syncScore, consistencyScore, symmetryScore, feifScores?.beatClarity);

    return new Response(JSON.stringify({
      kinematicMetrics,
      suspensionAnalysis,
      headPelvisMetrics,
      backMetrics,
      gaitClassification,
      feifScores,
      froudeNumber,
      lamenessAssessment,
      feiStandards,
      overallPerformance,
      processing_time_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calculate-advanced-metrics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
