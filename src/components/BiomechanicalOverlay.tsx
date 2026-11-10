import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { Play, Pause, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { KeypointsData, SuspensionData } from "@/types/gait";
import {
  LEG_COLORS, LEG_LABELS, LEG_JOINT_MAP,
  PHASE_LABELS, SUSPENSION_LABELS,
  heatColor, getJointHeatColors, findJointIssues,
  drawLegPoints, normalizeKeypoints, displaceLeg,
  getPhaseOffsetsForGait, getGaitPairings, getGaitMeta,
} from "@/lib/gaitCalculations";
import { useIsMobile } from "@/hooks/use-mobile";
import FootfallDiagram from "@/components/gait/FootfallDiagram";
import GaitPatternInfo from "@/components/gait/GaitPatternInfo";

// Re-export for backward compatibility
export type { SuspensionData } from "@/types/gait";

interface Props {
  keypoints: KeypointsData;
  jointAngles?: Record<string, Record<string, number>>;
  symmetryScore?: number;
  suspensionData?: SuspensionData;
  gaitType?: string;
  width?: number;
  height?: number;
}

const NUM_PHASES = 32;

const GAIT_OPTIONS_2D = [
  { value: "tolt", label: "טולט" },
  { value: "trot", label: "טרוט" },
  { value: "walk", label: "צעד" },
  { value: "pace", label: "פייס" },
  { value: "rack", label: "ראק" },
] as const;

export default memo(function BiomechanicalOverlay({ keypoints, jointAngles, symmetryScore, suspensionData, gaitType: initialGaitType, width: propWidth, height: propHeight }: Props) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [selectedGait, setSelectedGait] = useState(initialGaitType ?? "tolt");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: propWidth ?? 400, h: propHeight ?? 300 });
  const isMobile = useIsMobile();

  const gaitType = selectedGait;

  // Responsive sizing via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) {
          setContainerSize({ w, h: Math.round(w * 0.75) });
        }
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const width = containerSize.w;
  const height = containerSize.h;
  const fontSize = isMobile ? 10 : 8;

  const phaseOffsets = useMemo(() => getPhaseOffsetsForGait(gaitType), [gaitType]);
  const gaitMeta = useMemo(() => getGaitMeta(gaitType), [gaitType]);
  const pairings = useMemo(() => getGaitPairings(gaitType), [gaitType]);

  // Generate synthetic keypoints for procedural-only mode when no keypoints detected
  const syntheticKeypoints = useMemo((): KeypointsData | null => {
    if (keypoints?.detected) return null;
    // Create default skeleton positions for procedural animation
    return {
      detected: true,
      frontLeft: { shoulder: [0.25, 0.45], knee: [0.22, 0.60], fetlock: [0.20, 0.75], hoof: [0.19, 0.88] },
      frontRight: { shoulder: [0.30, 0.44], knee: [0.28, 0.59], fetlock: [0.26, 0.74], hoof: [0.25, 0.87] },
      hindLeft: { hip: [0.70, 0.42], stifle: [0.72, 0.58], fetlock: [0.73, 0.74], hoof: [0.74, 0.88] },
      hindRight: { hip: [0.75, 0.41], stifle: [0.77, 0.57], fetlock: [0.78, 0.73], hoof: [0.79, 0.87] },
      poll: [0.12, 0.30],
      withers: [0.32, 0.35],
      dock: [0.82, 0.38],
    } as KeypointsData;
  }, [keypoints?.detected]);

  const effectiveKeypoints = keypoints?.detected ? keypoints : syntheticKeypoints;

  const normalized = useMemo(
    () => effectiveKeypoints?.detected ? normalizeKeypoints(effectiveKeypoints, width, height) : null,
    [effectiveKeypoints, width, height]
  );
  const issues = useMemo(() => findJointIssues(jointAngles), [jointAngles]);
  const heatColors = useMemo(() => getJointHeatColors(jointAngles), [jointAngles]);
  const amplitude = Math.min(width, height) * 0.08;

  // Patch 4: requestAnimationFrame for drift-free 2D animation
  useEffect(() => {
    if (!effectiveKeypoints?.detected) return;
    let raf = 0;
    let last = performance.now();
    let localPhase = phaseIndex / NUM_PHASES;
    const gaitCycleHz = 1.25;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (isPlaying) {
        localPhase = (localPhase + dt * gaitCycleHz * speed) % 1;
        setPhaseIndex(Math.floor(localPhase * NUM_PHASES));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, speed, effectiveKeypoints?.detected]);

  const currentPhase = phaseIndex / NUM_PHASES;

  const animatedLegs = useMemo(() => {
    if (!normalized) return null;
    return {
      frontLeft: displaceLeg(normalized.frontLeft, currentPhase + (phaseOffsets.frontLeft ?? 0), amplitude, gaitType),
      frontRight: displaceLeg(normalized.frontRight, currentPhase + (phaseOffsets.frontRight ?? 0.5), amplitude, gaitType),
      hindLeft: displaceLeg(normalized.hindLeft, currentPhase + (phaseOffsets.hindLeft ?? 0.15), amplitude, gaitType),
      hindRight: displaceLeg(normalized.hindRight, currentPhase + (phaseOffsets.hindRight ?? 0.65), amplitude, gaitType),
    };
  }, [normalized, currentPhase, amplitude, phaseOffsets, gaitType]);

  const groundContact = useCallback((legName: string) => {
    const offset = phaseOffsets[legName] ?? 0;
    const legPhase = ((currentPhase + offset) % 1);
    return Math.abs(Math.sin(legPhase * Math.PI * 2)) < 0.3;
  }, [currentPhase, phaseOffsets]);

  const getPointColor = useCallback((legName: string, pointIndex: number, defaultColor: string): string => {
    if (!showHeatmap || !heatColors[legName]) return defaultColor;
    const joints = LEG_JOINT_MAP[legName];
    if (!joints || !joints[pointIndex]) return defaultColor;
    const jointData = heatColors[legName][joints[pointIndex]];
    return jointData ? jointData.color : defaultColor;
  }, [showHeatmap, heatColors]);

  const getSegmentColor = useCallback((legName: string, idx1: number, idx2: number, defaultColor: string): string => {
    if (!showHeatmap || !heatColors[legName]) return defaultColor;
    const joints = LEG_JOINT_MAP[legName];
    if (!joints) return defaultColor;
    const d1 = heatColors[legName]?.[joints[idx1]]?.deviation ?? 0;
    const d2 = heatColors[legName]?.[joints[idx2]]?.deviation ?? 0;
    return heatColor(Math.max(d1, d2));
  }, [showHeatmap, heatColors]);

  // Topline points (poll → withers → dock)
  const toplinePoints = useMemo(() => {
    if (!animatedLegs) return null;
    const pts: [number, number][] = [];
    // poll ~ head → use frontLeft shoulder as proxy for withers area
    const shoulder = animatedLegs.frontLeft?.shoulder;
    const hip = animatedLegs.hindLeft?.hip;
    if (shoulder && hip) {
      // Approximate poll (above and ahead of shoulder)
      const poll: [number, number] = [shoulder[0] - (hip[0] - shoulder[0]) * 0.3, shoulder[1] - Math.min(width, height) * 0.08];
      // Approximate withers (slightly above shoulder)
      const withers: [number, number] = [shoulder[0], shoulder[1] - Math.min(width, height) * 0.03];
      // Approximate dock (behind hip)
      const dock: [number, number] = [hip[0] + (hip[0] - shoulder[0]) * 0.15, hip[1] - Math.min(width, height) * 0.01];
      pts.push(poll, withers, dock);
    }
    return pts.length >= 3 ? pts : null;
  }, [animatedLegs, width, height]);

  if (!effectiveKeypoints?.detected || !normalized || !animatedLegs) return null;

  const phaseLabel = PHASE_LABELS[Math.floor(currentPhase * 4) % 4];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          {showHeatmap ? <Flame className="h-4 w-4 text-orange-400" /> : "🦴"} 
          {showHeatmap ? "מפת חום ביומכנית" : "שלד ביומכני"} — אנימציית מחזור צעידה
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Switch id="heatmap-toggle" checked={showHeatmap} onCheckedChange={setShowHeatmap} className="data-[state=checked]:bg-orange-500" />
            <Label htmlFor="heatmap-toggle" className="text-xs text-muted-foreground cursor-pointer">מפת חום</Label>
          </div>
          <span className="text-xs text-muted-foreground">{phaseLabel}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">×{speed.toFixed(speed < 1 ? 2 : 1)}</span>
            <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.25} max={3} step={0.25} className="w-20" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPlaying(p => !p)} aria-label={isPlaying ? "עצור אנימציה" : "הפעל אנימציה"}>
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Gait type selector */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] text-muted-foreground">סוג צעד:</span>
        {GAIT_OPTIONS_2D.map((g) => (
          <Button
            key={g.value}
            variant={selectedGait === g.value ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setSelectedGait(g.value)}
          >
            {g.label}
          </Button>
        ))}
      </div>

      <div ref={containerRef} className="bg-muted/30 rounded-xl p-4 flex flex-col items-center">
        <div className="w-full max-w-md mb-2 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-75" style={{ width: `${currentPhase * 100}%` }} />
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ aspectRatio: `${width}/${height}` }} role="img" aria-label="מפת חום ביומכנית של מפרקי הסוס — אנימציית מחזור צעידה">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.2" />
            </pattern>
            <filter id="heat-glow-red"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="heat-glow-yellow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />
          <line x1={0} y1={height * 0.88} x2={width} y2={height * 0.88} stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.3" strokeDasharray="4 4" />
          <text x={width - 4} y={height * 0.88 - 4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={fontSize + 1} opacity="0.5">קרקע</text>

          {/* Topline (poll → withers → dock) */}
          {toplinePoints && (
            <polyline
              points={toplinePoints.map(p => `${p[0]},${p[1]}`).join(" ")}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
          )}

          {/* Spine connection (shoulder → hip) */}
          {animatedLegs.frontLeft?.shoulder && animatedLegs.hindLeft?.hip && (
            <line x1={animatedLegs.frontLeft.shoulder[0]} y1={animatedLegs.frontLeft.shoulder[1]} x2={animatedLegs.hindLeft.hip[0]} y2={animatedLegs.hindLeft.hip[1]} stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="6 3" opacity="0.5" />
          )}

          {Object.entries(animatedLegs).map(([legName, kp]) => {
            if (!kp) return null;
            const points = drawLegPoints(kp);
            if (points.length < 2) return null;
            const color = LEG_COLORS[legName as keyof typeof LEG_COLORS];
            const onGround = groundContact(legName);
            return (
              <g key={legName}>
                {points.slice(1).map((pt, i) => {
                  const segColor = showHeatmap ? getSegmentColor(legName, i, i + 1 < points.length ? i + 1 : i, color) : color;
                  const segWidth = showHeatmap && heatColors[legName] ? 3.5 : 2;
                  return <line key={i} x1={points[i][0]} y1={points[i][1]} x2={pt[0]} y2={pt[1]} stroke={segColor} strokeWidth={segWidth} strokeLinecap="round" />;
                })}
                {points.map((pt, i) => {
                  const ptColor = showHeatmap ? getPointColor(legName, i, color) : color;
                  const dev = showHeatmap ? (heatColors[legName]?.[LEG_JOINT_MAP[legName]?.[i]]?.deviation ?? 0) : 0;
                  const radius = showHeatmap ? (dev > 0.3 ? 7 : dev > 0 ? 5.5 : 4) : 4;
                  const filter = showHeatmap && dev > 0.6 ? "url(#heat-glow-red)" : showHeatmap && dev > 0.3 ? "url(#heat-glow-yellow)" : undefined;
                  return (
                    <g key={i}>
                      <circle cx={pt[0]} cy={pt[1]} r={radius} fill={ptColor} stroke="white" strokeWidth="1.5" filter={filter} />
                      {showHeatmap && dev > 0.2 && heatColors[legName]?.[LEG_JOINT_MAP[legName]?.[i]] && (
                        <text x={pt[0] + 10} y={pt[1] - 6} fill={ptColor} fontSize={fontSize + 1} fontWeight="bold" opacity="0.9">
                          {Math.round(heatColors[legName][LEG_JOINT_MAP[legName][i]].value)}°
                        </text>
                      )}
                    </g>
                  );
                })}
                {onGround && points.length > 0 && (
                  <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={8} fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
                )}
              </g>
            );
          })}

          {/* Pairing arcs for gaited horse leg coordination */}
          {pairings.map(({ legs: [a, b], label }, idx) => {
            const legA = animatedLegs[a as keyof typeof animatedLegs];
            const legB = animatedLegs[b as keyof typeof animatedLegs];
            const ptA = legA?.hoof ?? legA?.fetlock;
            const ptB = legB?.hoof ?? legB?.fetlock;
            if (!ptA || !ptB) return null;
            const midX = (ptA[0] + ptB[0]) / 2;
            const midY = Math.min(ptA[1], ptB[1]) - 18;
            return (
              <g key={`pair-${idx}`} opacity="0.4">
                <path
                  d={`M ${ptA[0]} ${ptA[1] - 10} Q ${midX} ${midY - 12} ${ptB[0]} ${ptB[1] - 10}`}
                  fill="none"
                  stroke={gaitMeta?.tendency === "lateral" ? "#f59e0b" : "#3b82f6"}
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <text x={midX} y={midY - 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={fontSize} opacity="0.7">
                  {label}
                </text>
              </g>
            );
          })}

          {Object.entries(animatedLegs).map(([legName, kp]) => {
            if (!kp?.hoof) return null;
            return (
              <text key={legName} x={kp.hoof[0]} y={kp.hoof[1] + (isMobile ? 16 : 14)} textAnchor="middle" fill={LEG_COLORS[legName as keyof typeof LEG_COLORS]} fontSize={fontSize} opacity="0.7">
                {LEG_LABELS[legName]?.slice(0, 4)}
              </text>
            );
          })}
        </svg>

        {showHeatmap && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">תקין</span>
            <div className="w-24 h-2 rounded-full" style={{ background: "linear-gradient(to right, #22c55e, #eab308, #ef4444)" }} />
            <span className="text-[10px] text-muted-foreground">חריג</span>
          </div>
        )}

        {/* Gait pattern info badges for gaited horses */}
        <GaitPatternInfo gaitType={gaitType} />

        {/* Footfall pattern diagram */}
        <FootfallDiagram currentPhase={currentPhase} phaseOffsets={phaseOffsets} gaitType={gaitType} />

        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {Object.entries(LEG_COLORS).map(([leg, color]) => {
            const onGround = groundContact(leg);
            return (
              <div key={leg} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full transition-all duration-150" style={{ backgroundColor: color, boxShadow: onGround ? `0 0 6px ${color}` : "none", transform: onGround ? "scale(1.3)" : "scale(1)" }} />
                <span className="text-muted-foreground">{LEG_LABELS[leg]}</span>
                {onGround && <span className="text-[10px] text-primary">●</span>}
              </div>
            );
          })}
        </div>
      </div>

      {suspensionData && (
        <div className="bg-muted/20 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">⏱️ ניתוח זמן אוויר (Suspension Ratio)</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["FL", "FR", "HL", "HR"] as const).map((leg) => {
              const data = suspensionData[leg];
              if (!data) return null;
              const isGood = data.ratio >= 0.3 && data.ratio <= 0.6;
              const color = isGood ? "text-green-400" : data.ratio < 0.3 ? "text-red-400" : "text-amber-400";
              return (
                <div key={leg} className="bg-card/50 rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">{SUSPENSION_LABELS[leg]}</p>
                  <p className={`text-xl font-bold ${color}`}>{(data.ratio * 100).toFixed(0)}%</p>
                  <p className="text-[10px] text-muted-foreground">אוויר: {data.airTimeMs}ms | קרקע: {data.groundTimeMs}ms</p>
                </div>
              );
            })}
          </div>
          {suspensionData.asymmetryAlerts && suspensionData.asymmetryAlerts.length > 0 && (
            <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-destructive">⚠️ התראות אסימטריה:</p>
              {suspensionData.asymmetryAlerts.map((alert, i) => (
                <p key={i} className="text-xs text-destructive/80">{alert}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
          <p className="text-sm font-medium text-destructive">⚠️ חריגות מפרקים:</p>
          {issues.map((issue, i) => (
            <p key={i} className="text-xs text-destructive/80">
              {LEG_LABELS[issue.leg]} — {issue.joint}: {issue.value}° (נורמה: {issue.normal[0]}-{issue.normal[1]}°)
            </p>
          ))}
        </div>
      )}
    </div>
  );
});
