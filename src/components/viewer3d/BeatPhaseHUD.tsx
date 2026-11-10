// BeatPhaseHUD — "1-2-3-4" beat counter overlay for 3D viewer

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { LEG_COLORS, LEG_LABELS_SHORT, getPhaseOffsetsForGait, getGaitMeta, getStanceDuty } from "@/lib/gaitCalculations";

interface BeatPhaseHUDProps {
  phaseRef: React.MutableRefObject<number>;
  gaitType?: string;
}

export default function BeatPhaseHUD({ phaseRef, gaitType }: BeatPhaseHUDProps) {
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const beatCounterRef = useRef<HTMLSpanElement>(null);
  const stanceBarRefs = useRef<(HTMLDivElement | null)[]>([]);

  const meta = useMemo(() => getGaitMeta(gaitType), [gaitType]);
  const offsets = useMemo(() => getPhaseOffsetsForGait(gaitType), [gaitType]);
  const stanceDuty = useMemo(() => getStanceDuty(gaitType), [gaitType]);
  const legOrder = useMemo(() => {
    if (!offsets || typeof offsets !== "object") return [];
    return Object.entries(offsets)
      .sort((a, b) => a[1] - b[1])
      .map(([key, offset]) => ({ key, offset, color: LEG_COLORS[key], label: LEG_LABELS_SHORT[key] }));
  }, [offsets]);

  const lastBeatRef = useRef(-1);

  useFrame(() => {
    const phase = phaseRef.current;
    if (barRef.current) barRef.current.style.width = `${phase * 100}%`;

    let currentBeat = 0;
    legOrder.forEach((leg, i) => {
      const legPhase = (phase + leg.offset) % 1;
      const isStance = legPhase < stanceDuty;
      const dot = dotRefs.current[i];
      const stanceBar = stanceBarRefs.current[i];

      if (dot) {
        dot.style.transform = isStance ? "scale(1.4)" : "scale(0.8)";
        dot.style.opacity = isStance ? "1" : "0.4";
        dot.style.boxShadow = isStance ? `0 0 8px ${leg.color}` : "none";
      }

      if (stanceBar) {
        const stanceProgress = isStance ? (legPhase / stanceDuty) * 100 : 0;
        stanceBar.style.width = `${stanceProgress}%`;
        stanceBar.style.backgroundColor = isStance ? leg.color : "transparent";
        stanceBar.style.opacity = isStance ? "0.8" : "0";
      }

      if (isStance && legPhase < 0.05) {
        currentBeat = i + 1;
      }
    });

    if (beatCounterRef.current) {
      if (currentBeat > 0 && currentBeat !== lastBeatRef.current) {
        lastBeatRef.current = currentBeat;
        beatCounterRef.current.textContent = String(currentBeat);
        beatCounterRef.current.style.transform = "scale(1.6)";
        beatCounterRef.current.style.opacity = "1";
        setTimeout(() => {
          if (beatCounterRef.current) {
            beatCounterRef.current.style.transform = "scale(1)";
            beatCounterRef.current.style.opacity = "0.7";
          }
        }, 120);
      }
    }
  });

  if (!meta || meta.beats < 4) return null;

  return (
    <Html position={[0, -0.15, 0]} center style={{ pointerEvents: "none", width: "320px" }}>
      <div className="flex flex-col items-center gap-1.5 select-none" style={{ fontFamily: "system-ui" }}>
        <div className="flex items-center gap-2 mb-0.5">
          <span
            ref={beatCounterRef}
            style={{
              fontSize: 18, fontWeight: 800, fontFamily: "monospace",
              color: "hsl(var(--primary))",
              transition: "transform 0.12s ease-out, opacity 0.12s ease-out",
              opacity: 0.7, minWidth: 20, textAlign: "center",
            }}
          >
            1
          </span>
          <span style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1 }}>
            / {meta.beats} BEATS
          </span>
        </div>

        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(100,116,139,0.3)" }}>
          <div ref={barRef} className="h-full rounded-full transition-none" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))", width: "0%" }} />
        </div>

        <div className="flex gap-3 mt-0.5">
          {legOrder.map((leg, i) => (
            <div key={leg.key} className="flex flex-col items-center gap-0.5" style={{ minWidth: 40 }}>
              <div
                ref={(el) => { dotRefs.current[i] = el; }}
                className="rounded-full transition-transform duration-100"
                style={{ width: 14, height: 14, backgroundColor: leg.color, opacity: 0.4, transition: "transform 0.1s, opacity 0.1s, box-shadow 0.2s" }}
              />
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(100,116,139,0.15)" }}>
                <div
                  ref={(el) => { stanceBarRefs.current[i] = el; }}
                  className="h-full rounded-full transition-none"
                  style={{ width: "0%" }}
                />
              </div>
              <span style={{ fontSize: 8, color: "#94a3b8" }}>{leg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Html>
  );
}
