import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, BookOpen, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { COLOR_MAP, GAIT_TYPE_LABELS, localizeGait, type GaitInfo } from './gaitData';
import { useLanguage } from '@/contexts/LanguageContext';

function ComfortStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

function LateralityBar({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>⤢ Diagonal</span>
        <span>↔ Lateral</span>
      </div>
      <div className="h-2 rounded-full bg-muted/30 relative overflow-hidden">
        <motion.div
          className="absolute top-0 h-full rounded-full"
          style={{ backgroundColor: value > 0.5 ? 'hsl(38, 92%, 50%)' : 'hsl(217, 91%, 60%)' }}
          initial={{ width: 0, left: 0 }}
          animate={{ width: `${Math.abs(value - 0.5) * 200}%`, left: value >= 0.5 ? '50%' : `${value * 100}%` }}
          transition={{ type: 'spring', stiffness: 150 }}
        />
        <div className="absolute left-1/2 top-0 w-px h-full bg-foreground/20" />
      </div>
      <p className="text-[10px] text-center text-muted-foreground font-mono">
        {value.toFixed(2)} ({value === 0 ? 'pure diagonal' : value === 1 ? 'pure lateral' : value > 0.5 ? 'lateral bias' : value < 0.5 ? 'diagonal bias' : 'even'})
      </p>
    </div>
  );
}

export default function GaitInfoPanel({ gait: gaitBase }: { gait: GaitInfo }) {
  const [showRefs, setShowRefs] = useState(false);
  const { t, lang } = useLanguage();
  const gait = localizeGait(gaitBase, lang);
  const gaitTypeInfo = GAIT_TYPE_LABELS[gait.gaitType];
  const colors = COLOR_MAP[gait.color];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-bold text-foreground mb-1">{gait.name}</h4>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="outline" style={{ backgroundColor: colors.bgLight, borderColor: colors.border, color: colors.text }}>
            {gaitTypeInfo.icon} {lang === 'en' ? gaitTypeInfo.en : gaitTypeInfo.he} ({lang === 'en' ? gaitTypeInfo.he : gaitTypeInfo.en})
          </Badge>
          {gait.dmrt3Required && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
              🧬 DMRT3 {gait.dmrt3Genotype || 'AA'}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-muted-foreground leading-relaxed text-sm">{gait.description}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">{t("gip.beats")}</p>
          <p className="text-lg font-bold text-foreground">{gait.beats}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">{t("gip.speed")}</p>
          <p className="text-lg font-bold text-foreground">{gait.speed}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Duty Cycle</p>
          <p className="text-lg font-bold text-foreground">{Math.round(gait.dutyCycle * 100)}%</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Cadence</p>
          <p className="text-lg font-bold text-foreground">{gait.cadenceRange[0]}–{gait.cadenceRange[1]}</p>
          <p className="text-[10px] text-muted-foreground">strides/min</p>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-1">{t("gip.pattern")}</p>
        <p className="text-sm font-mono text-foreground" dir="ltr">{gait.pattern}</p>
      </div>

      <div className="bg-muted/30 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">Laterality Index (Hildebrand)</p>
        <LateralityBar value={gait.lateralityIndex} />
      </div>

      <div className="bg-muted/30 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-1">{t("gip.riderComfort")}</p>
        <ComfortStars rating={gait.comfortRating} />
      </div>

      <div className="bg-muted/30 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-1">{t("gip.commonBreeds")}</p>
        <div className="flex flex-wrap gap-1">
          {gait.breeds.map((b) => (
            <span key={b} className="text-xs bg-muted/50 rounded px-2 py-0.5 text-foreground">{b}</span>
          ))}
        </div>
      </div>

      {gait.references.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3">
          <button onClick={() => setShowRefs(!showRefs)} className="flex items-center gap-2 w-full text-left">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground flex-1">{t("gip.references")} ({gait.references.length})</p>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showRefs ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showRefs && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-2 space-y-2">
                  {gait.references.map((ref, i) => (
                    <div key={i} className="text-[11px] leading-relaxed">
                      <p className="text-foreground font-medium" dir="ltr">{ref.author} ({ref.year}). {ref.title}.</p>
                      {ref.journal && <p className="text-muted-foreground italic" dir="ltr">{ref.journal}</p>}
                      {ref.note && <p className="text-muted-foreground/70 text-[10px]">{ref.note}</p>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
