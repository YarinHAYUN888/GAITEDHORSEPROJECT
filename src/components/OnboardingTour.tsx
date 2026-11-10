import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const TOUR_KEY = "susitsa-tour-completed";

interface TourStep {
  target: string; // CSS selector
  titleKey: string;
  descKey: string;
  position: "top" | "bottom" | "left" | "right";
}

const STEPS: TourStep[] = [
  { target: "[data-tour='nav-analysis']", titleKey: "tour.step1.title", descKey: "tour.step1.desc", position: "bottom" },
  { target: "[data-tour='nav-dashboard']", titleKey: "tour.step2.title", descKey: "tour.step2.desc", position: "bottom" },
  { target: "[data-tour='nav-breeds']", titleKey: "tour.step3.title", descKey: "tour.step3.desc", position: "bottom" },
  { target: "[data-tour='hero-cta']", titleKey: "tour.step4.title", descKey: "tour.step4.desc", position: "top" },
];

export default function OnboardingTour() {
  const { t, dir } = useLanguage();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setActive(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateRect = useCallback(() => {
    if (!active) return;
    const el = document.querySelector(STEPS[step]?.target);
    if (el) {
      setRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setRect(null);
    }
  }, [step, active]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [updateRect]);

  const close = () => {
    setActive(false);
    localStorage.setItem(TOUR_KEY, "true");
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else close();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!active) return null;

  const currentStep = STEPS[step];
  const isRTL = dir === "rtl";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9998]" onClick={close}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

        {/* Spotlight cutout */}
        {rect && (
          <div
            className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-[9999] w-80 bg-card border border-border rounded-xl shadow-xl p-5"
          style={{
            top: rect ? (currentStep.position === "bottom" ? rect.bottom + 12 : rect.top - 180) : "50%",
            left: rect ? Math.min(Math.max(rect.left, 16), window.innerWidth - 336) : "50%",
            transform: rect ? undefined : "translate(-50%, -50%)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{step + 1}/{STEPS.length}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={close}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <h3 className="font-rubik font-bold text-foreground mb-1">{t(currentStep.titleKey)}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t(currentStep.descKey)}</p>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={prev} disabled={step === 0}>
              {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-primary" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
            <Button size="sm" onClick={next}>
              {step === STEPS.length - 1 ? t("tour.finish") : t("tour.next")}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
