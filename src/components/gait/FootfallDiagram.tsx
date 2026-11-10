import { memo, useMemo } from "react";
import { LEG_COLORS, LEG_LABELS, LEG_LABELS_SHORT, getGaitMeta, getFourBeatOrder } from "@/lib/gaitCalculations";

interface Props {
  currentPhase: number;
  phaseOffsets: Record<string, number>;
  gaitType?: string;
}

const STEPS = 24; // increased resolution for smoother visualization
const LEG_ORDER = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;

/** 
 * Footfall timeline: 4 rows showing stance (filled) vs swing (empty) across the gait cycle.
 * Enhanced with beat markers for four-beat gaits (Vincelette 2023).
 */
export default memo(function FootfallDiagram({ currentPhase, phaseOffsets, gaitType }: Props) {
  const meta = getGaitMeta(gaitType);
  const isFourBeat = meta?.beats === 4;
  const stanceDuty = meta?.stanceDuty ?? 0.5;
  // Stance threshold: higher duty = wider stance window
  const stanceThreshold = 0.15 + (stanceDuty - 0.5) * 1.5;

  const beatOrder = useMemo(() => getFourBeatOrder(gaitType), [gaitType]);

  const cells = useMemo(() => {
    const result: Record<string, boolean[]> = {};
    for (const leg of LEG_ORDER) {
      const offset = phaseOffsets[leg] ?? 0;
      result[leg] = Array.from({ length: STEPS }, (_, i) => {
        const stepPhase = ((i / STEPS) + offset) % 1;
        if (isFourBeat) {
          // Four-beat: sharper stance/swing transition
          const normalizedPhase = ((stepPhase % 1) + 1) % 1;
          return normalizedPhase < stanceDuty;
        }
        return Math.abs(Math.sin(stepPhase * Math.PI * 2)) < stanceThreshold;
      });
    }
    return result;
  }, [phaseOffsets, stanceThreshold, isFourBeat, stanceDuty]);

  // Count legs on ground per step for support indicator
  const supportCount = useMemo(() => {
    return Array.from({ length: STEPS }, (_, i) =>
      LEG_ORDER.reduce((count, leg) => count + (cells[leg][i] ? 1 : 0), 0)
    );
  }, [cells]);

  const activeStep = Math.floor(currentPhase * STEPS) % STEPS;

  // Sort legs by footfall order for four-beat gaits
  const displayOrder = useMemo(() => {
    if (isFourBeat && beatOrder.length === 4) {
      return beatOrder.map(b => b.legKey as typeof LEG_ORDER[number]);
    }
    return [...LEG_ORDER];
  }, [isFourBeat, beatOrder]);

  // Beat strike markers — which step index each beat falls on
  const beatMarkers = useMemo(() => {
    if (!isFourBeat) return [];
    return beatOrder.map(b => ({
      step: Math.round(b.phaseOffset * STEPS) % STEPS,
      color: b.color,
      label: b.label,
    }));
  }, [isFourBeat, beatOrder]);

  return (
    <div className="w-full max-w-md mt-3 space-y-0.5">
      <p className="text-[10px] text-muted-foreground text-center mb-1">
        תרשים Footfall — ■ דריכה □ תנופה
        {isFourBeat && " | ▼ נחיתה"}
      </p>

      {/* Beat number markers for four-beat gaits */}
      {isFourBeat && beatMarkers.length === 4 && (
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[9px] text-muted-foreground w-12 text-left shrink-0">פעימה</span>
          <div className="flex flex-1 gap-px relative">
            {Array.from({ length: STEPS }, (_, i) => {
              const marker = beatMarkers.find(m => m.step === i);
              return (
                <div
                  key={i}
                  className="flex-1 h-4 flex items-center justify-center"
                >
                  {marker && (
                    <span className="text-[9px] font-bold" style={{ color: marker.color }}>
                      ▼
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {displayOrder.map((leg) => {
        const color = LEG_COLORS[leg];
        const beatIndex = beatOrder.findIndex(b => b.legKey === leg);
        return (
          <div key={leg} className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground w-12 text-left shrink-0 truncate flex items-center gap-0.5">
              {isFourBeat && beatIndex >= 0 && (
                <span className="font-bold" style={{ color }}>{beatIndex + 1}</span>
              )}
              {(LEG_LABELS_SHORT[leg] || LEG_LABELS[leg])?.slice(0, 4)}
            </span>
            <div className="flex flex-1 gap-px">
              {cells[leg].map((isStance, i) => {
                const isBeatStrike = beatMarkers.some(m => m.step === i) && isStance;
                return (
                  <div
                    key={i}
                    className="flex-1 h-3.5 rounded-sm transition-all duration-75"
                    style={{
                      backgroundColor: isStance ? color : "transparent",
                      border: `1px solid ${color}`,
                      opacity: i === activeStep ? 1 : isBeatStrike ? 0.9 : 0.45,
                      transform: i === activeStep ? "scaleY(1.4)" : "scaleY(1)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Support count row */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-muted-foreground w-12 text-left shrink-0">תמיכה</span>
        <div className="flex flex-1 gap-px">
          {supportCount.map((count, i) => (
            <div
              key={i}
              className="flex-1 h-3.5 rounded-sm flex items-center justify-center transition-all duration-75"
              style={{
                backgroundColor: count >= 3 ? "hsl(var(--primary) / 0.3)" : count >= 2 ? "hsl(var(--primary) / 0.15)" : count === 0 ? "hsl(var(--destructive) / 0.2)" : "transparent",
                border: "1px solid hsl(var(--muted-foreground) / 0.3)",
                opacity: i === activeStep ? 1 : 0.5,
              }}
            >
              <span className="text-[7px] text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gait-specific info */}
      {meta && !meta.hasSuspension && (
        <p className="text-[9px] text-emerald-400 text-center mt-1">✓ ללא שלב ריחוף — תמיד לפחות רגל אחת על הקרקע</p>
      )}
      {isFourBeat && meta?.footfallOrder && (
        <p className="text-[9px] text-primary/70 text-center mt-0.5">
          סדר נחיתה: {meta.footfallOrder.join(" ← ")}
        </p>
      )}
    </div>
  );
});
