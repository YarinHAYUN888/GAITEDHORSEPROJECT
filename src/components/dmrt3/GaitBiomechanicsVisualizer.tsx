import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import HorseSVGDiagram from './HorseSVGDiagram';
import FootfallTimeline from './FootfallTimeline';
import GaitSelector from './GaitSelector';
import GaitInfoPanel from './GaitInfoPanel';
import { GAIT_TYPES, localizeGait, type GaitInfo } from './gaitData';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GaitBiomechanicsVisualizer() {
  const { t, lang } = useLanguage();
  const [selectedGaitBase, setSelectedGaitBase] = useState(GAIT_TYPES[0]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const selectedGait = localizeGait(selectedGaitBase, lang);
  const totalSteps = selectedGait.sequence.length;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % totalSteps);
      }, 600 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalSteps, speed]);

  const handleGaitChange = useCallback((gait: GaitInfo) => {
    setSelectedGaitBase(gait);
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  const activeLegs = selectedGait.sequence[currentStep]?.legs || [];
  const animationPhase = currentStep / totalSteps;

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-rubik font-bold">{t("gbv.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("gbv.subtitle")}</p>
        </div>
      </div>

      <GaitSelector selected={selectedGaitBase} onSelect={handleGaitChange} />

      <div className="grid md:grid-cols-2 gap-8 mt-6">
        <div className="flex flex-col items-center">
          <HorseSVGDiagram activeLegs={activeLegs} gaitColor={selectedGaitBase.color} phase={animationPhase} gait={selectedGaitBase} />

          <div className="flex gap-2 mt-2">
            {selectedGait.sequence.map((_, idx) => (
              <button key={idx} className="w-3 h-3 rounded-full transition-all"
                style={{ backgroundColor: idx === currentStep ? 'hsl(var(--primary))' : 'hsl(var(--muted) / 0.4)', transform: idx === currentStep ? 'scale(1.3)' : 'scale(1)' }}
                onClick={() => setCurrentStep(idx)} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.p key={currentStep} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground mt-1 h-5">
              {selectedGait.sequence[currentStep]?.label}
            </motion.p>
          </AnimatePresence>

          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="icon" onClick={() => setCurrentStep((p) => (p - 1 + totalSteps) % totalSteps)}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentStep((p) => (p + 1) % totalSteps)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => { setCurrentStep(0); setIsPlaying(false); }}><RotateCcw className="w-4 h-4" /></Button>
          </div>

          <div className="flex items-center gap-3 mt-3 w-full max-w-[220px]">
            <span className="text-[10px] text-muted-foreground">0.5x</span>
            <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={2} step={0.25} className="flex-1" />
            <span className="text-[10px] text-muted-foreground">2x</span>
            <span className="text-xs font-mono text-muted-foreground w-8 text-center">{speed}x</span>
          </div>

          <FootfallTimeline gait={selectedGaitBase} currentStep={currentStep} totalSteps={totalSteps} />
        </div>

        <GaitInfoPanel gait={selectedGaitBase} />
      </div>
    </motion.div>
  );
}
