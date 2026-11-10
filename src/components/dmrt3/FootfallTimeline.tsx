import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { COLOR_MAP, type GaitInfo } from './gaitData';
import { useLanguage } from '@/contexts/LanguageContext';

const LEG_ORDER = ['RF', 'LF', 'RH', 'LH'] as const;
const LEG_LABELS_HE: Record<string, string> = { LF: 'קד׳ שמ׳', RF: 'קד׳ ימ׳', LH: 'אח׳ שמ׳', RH: 'אח׳ ימ׳' };
const LEG_LABELS_EN: Record<string, string> = { LF: 'LF', RF: 'RF', LH: 'LH', RH: 'RH' };
const STEPS = 12;

interface Props { gait: GaitInfo; currentStep: number; totalSteps: number; }

export default function FootfallTimeline({ gait, currentStep, totalSteps }: Props) {
  const { t, lang } = useLanguage();
  const colors = COLOR_MAP[gait.color];
  const steps = gait.footfall;
  const legLabels = lang === 'en' ? LEG_LABELS_EN : LEG_LABELS_HE;
  const activeFootfallIdx = Math.floor((currentStep / totalSteps) * STEPS) % STEPS;

  const supportCount = useMemo(() => {
    return Array.from({ length: STEPS }, (_, i) =>
      LEG_ORDER.reduce((sum, leg) => sum + (steps[leg]?.[i] ? 1 : 0), 0)
    );
  }, [steps]);

  return (
    <div className="w-full mt-4">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{t("fft.title")}</p>
      <div className="space-y-1">
        {LEG_ORDER.map((leg) => {
          const pattern = steps[leg] || [];
          return (
            <div key={leg} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-12 text-left font-mono">{legLabels[leg]}</span>
              <div className="flex-1 flex gap-px">
                {Array.from({ length: STEPS }, (_, idx) => {
                  const onGround = pattern[idx] ?? false;
                  const isActive = idx === activeFootfallIdx;
                  return (
                    <div key={idx} className="flex-1 rounded-sm transition-all duration-150 relative"
                      style={{
                        height: isActive ? 18 : 14,
                        backgroundColor: onGround ? colors.bg : 'hsl(var(--muted) / 0.15)',
                        opacity: onGround ? (isActive ? 1 : 0.7) : 0.3,
                        boxShadow: isActive && onGround ? `0 0 8px ${colors.glow}` : undefined,
                      }}>
                      {isActive && (
                        <motion.div layoutId="footfall-marker" className="absolute inset-0 rounded-sm border-2"
                          style={{ borderColor: 'hsl(var(--foreground))' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground w-12 text-left font-mono">{t("fft.support")}</span>
        <div className="flex-1 flex gap-px">
          {supportCount.map((count, idx) => {
            const isActive = idx === activeFootfallIdx;
            return (
              <div key={idx} className="flex-1 flex items-center justify-center rounded-sm text-[9px] font-mono transition-all duration-150"
                style={{
                  height: 14,
                  backgroundColor: count === 0 ? 'hsl(var(--destructive) / 0.2)' : count === 1 ? 'hsl(var(--warning, 38 92% 50%) / 0.2)' : 'hsl(var(--muted) / 0.15)',
                  color: count === 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))',
                  fontWeight: isActive ? 700 : 400,
                }}>
                {count}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="w-12" />
        <div className="flex-1 flex gap-px">
          {Array.from({ length: STEPS }).map((_, idx) => (
            <span key={idx} className="flex-1 text-center text-[8px] text-muted-foreground/40">
              {Math.round((idx / STEPS) * 100)}%
            </span>
          ))}
        </div>
      </div>

      {gait.suspensionFraction > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          ✈ Suspension: {Math.round(gait.suspensionFraction * 100)}% {lang === 'en' ? 'of stride' : 'מהצעד'}
        </p>
      )}
      {gait.suspensionFraction === 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">{t("fft.noFlight")}</p>
      )}
    </div>
  );
}
