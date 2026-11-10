import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Footprints, Video, BarChart3, ChevronLeft, ChevronRight, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { breeds } from "@/data/breeds";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/components/ui/use-toast";

const STEPS = [
  { icon: Footprints, key: "addHorse" },
  { icon: Video, key: "uploadVideo" },
  { icon: BarChart3, key: "viewResults" },
] as const;

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { t, dir, lang } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [horseName, setHorseName] = useState("");
  const [breedId, setBreedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdHorseId, setCreatedHorseId] = useState<string | null>(null);

  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;

  const handleCreateHorse = useCallback(async () => {
    if (!horseName.trim()) {
      toast({ title: t("onboarding.nameRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("horses")
        .insert({ name: horseName.trim(), breed_id: breedId || null })
        .select("id")
        .single();
      if (error) throw error;
      setCreatedHorseId(data.id);
      toast({ title: t("onboarding.horseCreated") });
      setStep(1);
    } catch (e: any) {
      toast({ title: e.message || t("onboarding.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [horseName, breedId, t]);

  const handleGoToAnalysis = useCallback(() => {
    localStorage.setItem("onboarding-done", "true");
    onComplete();
    navigate("/gait-analysis");
  }, [navigate, onComplete]);

  const handleGoToProfile = useCallback(() => {
    localStorage.setItem("onboarding-done", "true");
    onComplete();
    if (createdHorseId) {
      navigate(`/horse/${createdHorseId}`);
    } else {
      navigate("/dashboard");
    }
  }, [navigate, onComplete, createdHorseId]);

  const handleSkip = useCallback(() => {
    localStorage.setItem("onboarding-done", "true");
    onComplete();
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <Card className="w-full max-w-lg border-primary/20 shadow-2xl shadow-primary/10">
        <CardContent className="p-6 sm:p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary/20 text-primary ring-2 ring-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <h2 className="text-xl font-rubik font-bold mb-1">{t("onboarding.step1Title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("onboarding.step1Desc")}</p>
                </div>
                <div className="space-y-3">
                  <Input
                    placeholder={t("onboarding.horseName")}
                    value={horseName}
                    onChange={(e) => setHorseName(e.target.value)}
                    className="text-base"
                    dir="auto"
                  />
                  <Select value={breedId} onValueChange={setBreedId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("onboarding.selectBreed")} />
                    </SelectTrigger>
                    <SelectContent>
                      {breeds.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {lang === "he" ? b.nameHe : b.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleCreateHorse} disabled={saving} className="flex-1 gap-2">
                    <Plus className="w-4 h-4" />
                    {saving ? "..." : t("onboarding.createHorse")}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <h2 className="text-xl font-rubik font-bold mb-1">{t("onboarding.step2Title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("onboarding.step2Desc")}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-6 text-center space-y-3">
                  <Video className="w-12 h-12 text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">{t("onboarding.step2Hint")}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="outline">{t("onboarding.tipSide")}</Badge>
                    <Badge variant="outline">{t("onboarding.tipSteady")}</Badge>
                    <Badge variant="outline">{t("onboarding.tipSeconds")}</Badge>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(0)} className="gap-1">
                    <PrevIcon className="w-4 h-4" />
                    {t("onboarding.back")}
                  </Button>
                  <Button onClick={handleGoToAnalysis} className="flex-1 gap-2">
                    <Video className="w-4 h-4" />
                    {t("onboarding.goToAnalysis")}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <h2 className="text-xl font-rubik font-bold mb-1">{t("onboarding.step3Title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("onboarding.step3Desc")}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-6 text-center space-y-2">
                  <BarChart3 className="w-12 h-12 text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">{t("onboarding.step3Hint")}</p>
                </div>
                <Button onClick={handleGoToProfile} className="w-full gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {t("onboarding.goToProfile")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skip */}
          <button
            onClick={handleSkip}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
          >
            {t("onboarding.skip")}
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
