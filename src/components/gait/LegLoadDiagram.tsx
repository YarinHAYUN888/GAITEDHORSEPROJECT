import { memo, useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPhaseOffsetsForGait, getStanceDuty, getGaitMeta } from "@/lib/gaitCalculations";
import type { GRFMetrics } from "@/types/biomech";
import type { GaitAnalysisResult } from "@/types/gait";

interface LegStatus {
  key: string;
  label: string;
  labelEn: string;
  load: number; // 0-1 normalized
  severity: "normal" | "mild" | "moderate" | "high";
  description: string;
  descriptionEn: string;
}

function getSeverity(load: number, avgLoad: number): "normal" | "mild" | "moderate" | "high" {
  const ratio = Math.abs(load - avgLoad) / (avgLoad || 1);
  if (ratio < 0.1) return "normal";
  if (ratio < 0.2) return "mild";
  if (ratio < 0.35) return "moderate";
  return "high";
}

const SEVERITY_COLORS = {
  normal: "hsl(var(--muted-foreground))",
  mild: "hsl(160, 60%, 50%)",
  moderate: "hsl(45, 90%, 55%)",
  high: "hsl(0, 75%, 55%)",
};

const SEVERITY_GLOW = {
  normal: "none",
  mild: "0 0 8px hsla(160, 60%, 50%, 0.4)",
  moderate: "0 0 10px hsla(45, 90%, 55%, 0.5)",
  high: "0 0 14px hsla(0, 75%, 55%, 0.6)",
};

interface Props {
  result: GaitAnalysisResult;
}

export default memo(function LegLoadDiagram({ result }: Props) {
  const { lang } = useLanguage();
  const isHe = lang === "he";
  const [isPlaying, setIsPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const rafRef = useRef(0);
  const lastRef = useRef(performance.now());
  const gaitType = result.gaitType;

  const offsets = useMemo(() => getPhaseOffsetsForGait(gaitType), [gaitType]);
  const stanceDuty = useMemo(() => getStanceDuty(gaitType), [gaitType]);
  const gaitMeta = useMemo(() => getGaitMeta(gaitType), [gaitType]);

  // Animate phase
  useEffect(() => {
    let localPhase = phase;
    const cycleHz = 1.0;
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (isPlaying) {
        localPhase = (localPhase + dt * cycleHz) % 1;
        setPhase(localPhase);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const legs = useMemo(() => {
    const grfMetrics = result.biomechMetrics?.grfMetrics;
    const suspension = result.suspensionAnalysis;

    // Build per-leg load data from available sources
    const legData: Record<string, number> = { LF: 0.5, RF: 0.5, LH: 0.5, RH: 0.5 };

    if (grfMetrics?.perLimb) {
      const limbs = grfMetrics.perLimb;
      const keys = Object.keys(limbs) as Array<keyof typeof limbs>;
      const mapped: Record<string, number> = {};
      keys.forEach(k => {
        const limb = limbs[k];
        if (limb) mapped[k] = limb.peakImpact ?? limb.meanStanceLoad ?? 0.5;
      });
      // Normalize the keys to our format
      if (mapped["LF"] !== undefined) legData.LF = mapped["LF"];
      if (mapped["RF"] !== undefined) legData.RF = mapped["RF"];
      if (mapped["LH"] !== undefined) legData.LH = mapped["LH"];
      if (mapped["RH"] !== undefined) legData.RH = mapped["RH"];
    } else if (suspension) {
      // Fallback: use suspension timing asymmetry
      const timings = [suspension.FL, suspension.FR, suspension.HL, suspension.HR].filter(Boolean);
      if (timings.length > 0) {
        const avgGround = timings.reduce((s, t) => s + (t?.groundTimeMs ?? 0), 0) / timings.length;
        if (suspension.FL) legData.LF = (suspension.FL.groundTimeMs / (avgGround || 1));
        if (suspension.FR) legData.RF = (suspension.FR.groundTimeMs / (avgGround || 1));
        if (suspension.HL) legData.LH = (suspension.HL.groundTimeMs / (avgGround || 1));
        if (suspension.HR) legData.RH = (suspension.HR.groundTimeMs / (avgGround || 1));
      }
    }

    // Compute average for severity detection
    const vals = Object.values(legData);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

    const legConfigs: LegStatus[] = [
      {
        key: "LF",
        label: "שמאל קדמי",
        labelEn: "LF",
        load: legData.LF,
        severity: getSeverity(legData.LF, avg),
        description: getDescriptionHe(legData.LF, avg),
        descriptionEn: getDescriptionEn(legData.LF, avg),
      },
      {
        key: "RF",
        label: "ימין קדמי",
        labelEn: "RF",
        load: legData.RF,
        severity: getSeverity(legData.RF, avg),
        description: getDescriptionHe(legData.RF, avg),
        descriptionEn: getDescriptionEn(legData.RF, avg),
      },
      {
        key: "LH",
        label: "שמאל אחורי",
        labelEn: "LH",
        load: legData.LH,
        severity: getSeverity(legData.LH, avg),
        description: getDescriptionHe(legData.LH, avg),
        descriptionEn: getDescriptionEn(legData.LH, avg),
      },
      {
        key: "RH",
        label: "ימין אחורי",
        labelEn: "RH",
        load: legData.RH,
        severity: getSeverity(legData.RH, avg),
        description: getDescriptionHe(legData.RH, avg),
        descriptionEn: getDescriptionEn(legData.RH, avg),
      },
    ];

    return legConfigs;
  }, [result]);

  const hasAnyIssue = legs.some(l => l.severity !== "normal");

  // Compute leg positions based on phase
  const legPositions = useMemo(() => {
    const legKeys = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;
    const basePositions = [
      { x: 80, y: 110, hind: false },
      { x: 100, y: 108, hind: false },
      { x: 225, y: 105, hind: true },
      { x: 245, y: 103, hind: true },
    ];
    return basePositions.map((pos, i) => {
      const legKey = legKeys[i];
      const offset = offsets[legKey] ?? 0;
      const legPhase = ((phase + offset) % 1 + 1) % 1;
      const inStance = legPhase < stanceDuty;
      // Swing arc: lift hoof up in an arc during swing phase
      const swingProgress = inStance ? 0 : (legPhase - stanceDuty) / (1 - stanceDuty);
      const liftAmount = inStance ? 0 : Math.sin(swingProgress * Math.PI) * 35;
      const forwardShift = inStance ? 0 : Math.sin(swingProgress * Math.PI) * (pos.hind ? 12 : -10);
      return { ...pos, liftAmount, forwardShift, inStance };
    });
  }, [phase, offsets, stanceDuty]);

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          🦵 {isHe ? "מפת עומסים על הרגליים" : "Leg Load Distribution"}
          {gaitMeta && <span className="text-xs font-normal text-muted-foreground">({gaitMeta.nameHe})</span>}
          {hasAnyIssue && (
            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
              {isHe ? "אסימטריה זוהתה" : "Asymmetry Detected"}
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 mr-auto" onClick={() => setIsPlaying(p => !p)}>
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {/* SVG Horse Silhouette */}
          <svg viewBox="0 0 400 320" className="w-full max-w-sm" aria-label={isHe ? "מפת עומסים על רגלי הסוס" : "Horse leg load map"}>
            {/* Horse body silhouette */}
            <g transform="translate(50, 20)">
              {/* Head & Neck */}
              <path
                d="M40,80 Q30,60 25,40 Q20,20 30,10 Q40,5 50,15 Q55,25 52,40 Q50,55 55,70 Q58,78 60,85"
                fill="none"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Ear */}
              <path
                d="M32,12 Q28,2 35,5"
                fill="none"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Body */}
              <path
                d="M60,85 Q80,75 120,72 Q160,70 200,72 Q230,75 250,82 Q260,88 265,95"
                fill="none"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Belly line */}
              <path
                d="M70,110 Q100,125 150,128 Q200,125 240,115"
                fill="none"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 3"
                opacity="0.4"
              />
              {/* Tail */}
              <path
                d="M265,95 Q275,85 280,70 Q282,60 278,55"
                fill="none"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Front Left Leg (LF) */}
              <LegSVG x={legPositions[0].x} y={legPositions[0].y} leg={legs[0]} liftAmount={legPositions[0].liftAmount} forwardShift={legPositions[0].forwardShift} inStance={legPositions[0].inStance} />

              {/* Front Right Leg (RF) - slightly offset for depth */}
              <LegSVG x={legPositions[1].x} y={legPositions[1].y} leg={legs[1]} opacity={0.7} liftAmount={legPositions[1].liftAmount} forwardShift={legPositions[1].forwardShift} inStance={legPositions[1].inStance} />

              {/* Hind Left Leg (LH) */}
              <LegSVG x={legPositions[2].x} y={legPositions[2].y} leg={legs[2]} hind liftAmount={legPositions[2].liftAmount} forwardShift={legPositions[2].forwardShift} inStance={legPositions[2].inStance} />

              {/* Hind Right Leg (RH) - slightly offset */}
              <LegSVG x={legPositions[3].x} y={legPositions[3].y} leg={legs[3]} hind opacity={0.7} liftAmount={legPositions[3].liftAmount} forwardShift={legPositions[3].forwardShift} inStance={legPositions[3].inStance} />
            </g>

            {/* Load direction arrows */}
            {legs.map((leg, i) => {
              if (leg.severity === "normal") return null;
              const positions = [
                { x: 130, y: 265 },
                { x: 150, y: 263 },
                { x: 275, y: 260 },
                { x: 295, y: 258 },
              ];
              const pos = positions[i];
              const color = SEVERITY_COLORS[leg.severity];
              const isOverloaded = leg.load > (Object.values(legs.reduce((s, l) => ({ ...s, [l.key]: l.load }), {} as Record<string, number>)).reduce((a, b) => a + b, 0) / 4);
              return (
                <g key={leg.key}>
                  <line
                    x1={pos.x}
                    y1={pos.y - 15}
                    x2={pos.x}
                    y2={isOverloaded ? pos.y + 8 : pos.y - 30}
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    markerEnd={`url(#arrow-${leg.severity})`}
                  />
                </g>
              );
            })}

            {/* Arrow markers */}
            <defs>
              {(["mild", "moderate", "high"] as const).map(sev => (
                <marker
                  key={sev}
                  id={`arrow-${sev}`}
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={SEVERITY_COLORS[sev]} />
                </marker>
              ))}
            </defs>
          </svg>

          {/* Legend */}
          <div className="w-full space-y-1.5">
            {legs.filter(l => l.severity !== "normal").map(leg => (
              <div key={leg.key} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: SEVERITY_COLORS[leg.severity] }}
                >
                  {leg.labelEn}
                </span>
                <span className="text-muted-foreground text-xs">
                  {isHe ? leg.description : leg.descriptionEn}
                </span>
              </div>
            ))}
            {!hasAnyIssue && (
              <p className="text-sm text-center text-muted-foreground">
                {isHe ? "✅ פיזור עומסים סימטרי — לא זוהו חריגות" : "✅ Symmetric load distribution — no anomalies detected"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

/* ── SVG Leg segment ── */
function LegSVG({ x, y, leg, hind, opacity = 1, liftAmount = 0, forwardShift = 0, inStance = true }: { x: number; y: number; leg: LegStatus; hind?: boolean; opacity?: number; liftAmount?: number; forwardShift?: number; inStance?: boolean }) {
  const color = SEVERITY_COLORS[leg.severity];
  const glow = SEVERITY_GLOW[leg.severity];
  const legLength = 120;

  // Animated positions
  const endX = (hind ? x + 8 : x - 3) + forwardShift;
  const midX = (hind ? x + 4 : x - 1) + forwardShift * 0.5;
  const kneeY = y + legLength * 0.45 - liftAmount * 0.3;
  const endY = y + legLength - liftAmount;

  return (
    <g opacity={opacity}>
      {/* Upper leg */}
      <line
        x1={x}
        y1={y}
        x2={midX}
        y2={kneeY}
        stroke={leg.severity === "normal" ? "hsl(var(--muted-foreground))" : color}
        strokeWidth={leg.severity === "normal" ? 2.5 : 3.5}
        strokeLinecap="round"
        style={{ filter: glow !== "none" ? `drop-shadow(${glow})` : undefined }}
      />
      {/* Lower leg */}
      <line
        x1={midX}
        y1={kneeY}
        x2={endX}
        y2={endY}
        stroke={leg.severity === "normal" ? "hsl(var(--muted-foreground))" : color}
        strokeWidth={leg.severity === "normal" ? 2.5 : 3.5}
        strokeLinecap="round"
        style={{ filter: glow !== "none" ? `drop-shadow(${glow})` : undefined }}
      />
      {/* Hoof */}
      <ellipse
        cx={endX}
        cy={endY + 3}
        rx={5}
        ry={3}
        fill={leg.severity === "normal" ? "hsl(var(--muted-foreground))" : color}
        opacity={0.7}
      />
      {/* Ground contact ring */}
      {inStance && (
        <ellipse
          cx={endX}
          cy={endY + 5}
          rx={7}
          ry={2}
          fill="none"
          stroke={leg.severity === "normal" ? "hsl(var(--muted-foreground))" : color}
          strokeWidth="1.5"
          opacity={0.5}
        />
      )}
      {/* Load intensity indicator bar beside the leg */}
      {leg.severity !== "normal" && inStance && (
        <rect
          x={endX + (hind ? 8 : -14)}
          y={endY - 25}
          width={4}
          height={25 * Math.min(leg.load * 1.5, 1)}
          rx={2}
          fill={color}
          opacity={0.6}
        />
      )}
    </g>
  );
}

function getDescriptionHe(load: number, avg: number): string {
  const ratio = (load - avg) / (avg || 1);
  if (Math.abs(ratio) < 0.1) return "עומס תקין";
  const intensity = Math.abs(ratio) < 0.2 ? "קלה" : Math.abs(ratio) < 0.35 ? "בינונית" : "משמעותית";
  if (ratio > 0) return `עומס יתר ${intensity} בנחיתה`;
  return `אסימטריה ${intensity} בדחיפה`;
}

function getDescriptionEn(load: number, avg: number): string {
  const ratio = (load - avg) / (avg || 1);
  if (Math.abs(ratio) < 0.1) return "Normal load";
  const intensity = Math.abs(ratio) < 0.2 ? "Mild" : Math.abs(ratio) < 0.35 ? "Moderate" : "Significant";
  if (ratio > 0) return `${intensity} impact asymmetry`;
  return `${intensity} push-off asymmetry`;
}
