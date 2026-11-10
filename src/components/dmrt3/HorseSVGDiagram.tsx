import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLOR_MAP, type GaitColor, type GaitInfo } from './gaitData';
import { useLanguage } from '@/contexts/LanguageContext';

const LEG_POSITIONS = {
  LF: { cx: 125, cy: 55, anchorY: 35 },
  RF: { cx: 275, cy: 55, anchorY: 35 },
  LH: { cx: 110, cy: 195, anchorY: 175 },
  RH: { cx: 290, cy: 195, anchorY: 175 },
};

function ConnectionArcs({ activeLegs, color }: { activeLegs: string[]; color: string }) {
  const pairs: [string, string][] = [];
  for (let i = 0; i < activeLegs.length; i++) {
    for (let j = i + 1; j < activeLegs.length; j++) {
      pairs.push([activeLegs[i], activeLegs[j]]);
    }
  }
  return (
    <>
      {pairs.map(([a, b]) => {
        const pa = LEG_POSITIONS[a as keyof typeof LEG_POSITIONS];
        const pb = LEG_POSITIONS[b as keyof typeof LEG_POSITIONS];
        if (!pa || !pb) return null;
        const midX = (pa.cx + pb.cx) / 2;
        const midY = (pa.cy + pb.cy) / 2;
        const isLateral = (a.includes('L') && b.includes('L')) || (a.includes('R') && b.includes('R'));
        const curveOffset = isLateral ? 15 : -20;
        const d = `M ${pa.cx} ${pa.cy} Q ${midX} ${midY + curveOffset} ${pb.cx} ${pb.cy}`;
        return (
          <motion.path key={`${a}-${b}`} d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 4"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />
        );
      })}
    </>
  );
}

function AnimatedSpine({ lateralityIndex, phase, color }: { lateralityIndex: number; phase: number; color: string }) {
  const amplitude = lateralityIndex * 8;
  const yOffset = Math.sin(phase * Math.PI * 2) * amplitude;
  const midY = 125 + yOffset;
  return (
    <motion.path d={`M 120 125 Q 200 ${midY} 280 125`} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 3"
      animate={{ d: `M 120 125 Q 200 ${midY} 280 125` }} transition={{ type: 'spring', stiffness: 150, damping: 15 }} />
  );
}

function HeadBob({ hasSuspension, phase, color }: { hasSuspension: boolean; phase: number; color: string }) {
  const bobAmount = hasSuspension ? 6 : 2;
  const headY = 75 + Math.sin(phase * Math.PI * 2) * bobAmount;
  return (
    <motion.ellipse cx={310} cy={headY} rx={22} ry={32} fill="hsl(var(--muted) / 0.2)" stroke="hsl(var(--border) / 0.4)" strokeWidth={1.2}
      animate={{ cy: headY }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} />
  );
}

interface Props {
  activeLegs: string[];
  gaitColor: GaitColor;
  phase?: number;
  gait?: GaitInfo;
}

export default function HorseSVGDiagram({ activeLegs, gaitColor, phase = 0, gait }: Props) {
  const { lang } = useLanguage();
  const colors = COLOR_MAP[gaitColor];
  const lateralityIndex = gait?.lateralityIndex ?? 0.5;
  const hasSuspension = (gait?.suspensionFraction ?? 0) > 0;

  const couplingType = useMemo(() => {
    if (activeLegs.length < 2) return null;
    const hasL = activeLegs.some(l => l.startsWith('L'));
    const hasR = activeLegs.some(l => l.startsWith('R'));
    const hasF = activeLegs.some(l => l.endsWith('F'));
    const hasH = activeLegs.some(l => l.endsWith('H'));
    if (hasL && !hasR) return 'LATERAL';
    if (hasR && !hasL) return 'LATERAL';
    if ((hasL && hasR) && (hasF && hasH)) return 'DIAGONAL';
    return null;
  }, [activeLegs]);

  const legSubLabels = lang === 'en'
    ? { LF: ['Fr.', 'L'], RF: ['Fr.', 'R'], LH: ['Hi.', 'L'], RH: ['Hi.', 'R'] }
    : { LF: ['קד׳', 'שמ׳'], RF: ['קד׳', 'ימ׳'], LH: ['אח׳', 'שמ׳'], RH: ['אח׳', 'ימ׳'] };

  return (
    <svg viewBox="0 0 400 260" className="w-full max-w-xs mx-auto" aria-label="Horse leg diagram">
      <defs>
        <filter id={`glow-${gaitColor}`}>
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`grad-${gaitColor}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.bg} stopOpacity={0.15} />
          <stop offset="100%" stopColor={colors.bg} stopOpacity={0.05} />
        </linearGradient>
      </defs>

      <ellipse cx="200" cy="125" rx="100" ry="55" fill={`url(#grad-${gaitColor})`} stroke="hsl(var(--border) / 0.4)" strokeWidth="1.5" />
      <HeadBob hasSuspension={hasSuspension} phase={phase} color={colors.bg} />
      <ellipse cx="320" cy="48" rx="6" ry="12" fill="hsl(var(--muted) / 0.15)" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" />
      <path d="M 290 95 Q 305 85 310 75" fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="1.5" />
      <path d="M 100 125 Q 65 115 55 140 Q 50 155 60 160" fill="none" stroke="hsl(var(--border) / 0.4)" strokeWidth="2.5" strokeLinecap="round" />
      <AnimatedSpine lateralityIndex={lateralityIndex} phase={phase} color={`hsl(var(--border) / 0.25)`} />
      <AnimatePresence><ConnectionArcs activeLegs={activeLegs} color={colors.bg} /></AnimatePresence>

      {couplingType && (
        <motion.text x={200} y={125} textAnchor="middle" dominantBaseline="central" className="text-[9px] font-mono select-none pointer-events-none"
          fill={colors.text} initial={{ opacity: 0 }} animate={{ opacity: 0.6 }}>{couplingType}</motion.text>
      )}

      {Object.entries(LEG_POSITIONS).map(([leg, pos]) => {
        const isActive = activeLegs.includes(leg);
        const labels = legSubLabels[leg as keyof typeof legSubLabels];
        const liftY = isActive ? -8 : 0;
        return (
          <g key={leg}>
            <motion.line x1={pos.cx} y1={pos.anchorY + 20} x2={pos.cx} y2={pos.cy}
              stroke={isActive ? colors.bg : 'hsl(var(--border) / 0.2)'} strokeWidth={isActive ? 2 : 1}
              animate={{ y2: pos.cy + liftY }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} />
            {isActive && (
              <motion.circle cx={pos.cx} cy={pos.cy + liftY} r={20} fill={colors.bg} opacity={0.2}
                filter={`url(#glow-${gaitColor})`} initial={{ r: 14 }} animate={{ r: 22 }} transition={{ type: 'spring', stiffness: 200 }} />
            )}
            <motion.circle cx={pos.cx} cy={pos.cy} r={16} fill={isActive ? colors.bg : 'hsl(var(--muted) / 0.35)'}
              stroke={isActive ? colors.border : 'hsl(var(--border) / 0.4)'} strokeWidth={isActive ? 2 : 1}
              animate={{ cy: pos.cy + liftY, r: isActive ? 18 : 16 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} />
            <motion.text x={pos.cx} y={pos.cy + 1} textAnchor="middle" dominantBaseline="central"
              className="text-[10px] font-bold select-none pointer-events-none"
              fill={isActive ? 'white' : 'hsl(var(--muted-foreground))'}
              animate={{ y: pos.cy + liftY + 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>{leg}</motion.text>
            <text x={pos.cx} y={pos.cy + 30} textAnchor="middle" className="text-[8px] select-none pointer-events-none"
              fill="hsl(var(--muted-foreground) / 0.7)">{labels[0]} {labels[1]}</text>
          </g>
        );
      })}

      <line x1="40" y1="245" x2="360" y2="245" stroke="hsl(var(--border) / 0.2)" strokeWidth="1" />

      {activeLegs.length === 0 && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <text x={200} y={235} textAnchor="middle" className="text-[10px] font-medium select-none" fill={colors.text}>✈ SUSPENSION</text>
        </motion.g>
      )}
    </svg>
  );
}
