import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { questionnaireSchema } from "@/lib/validationSchemas";

export interface QuestionnaireAnswers {
  primaryGoal: string;
  targetStyle: string;
  primaryUse: string;
  outputPreference: string[];
  additionalInfo: string;
}

interface Props {
  onComplete: (answers: QuestionnaireAnswers) => void;
}

export default function PreAnalysisQuestionnaire({ onComplete }: Props) {
  const { t, dir, lang } = useLanguage();
  const [goal, setGoal] = useState("");
  const [style, setStyle] = useState("");
  const [use, setUse] = useState("");
  const [outputPref, setOutputPref] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState("");

  const GOALS = [
    { value: "structure-match", label: t("preq.goal.structureMatch") },
    { value: "performance", label: t("preq.goal.performance") },
    { value: "risk-detection", label: t("preq.goal.riskDetection") },
    { value: "general", label: t("preq.goal.general") },
  ];

  const STYLES = [
    { value: "standardbred", label: "Standardbred" },
    { value: "trotter", label: "Trotter" },
    { value: "pacer", label: "Pacer" },
    { value: "racking", label: "Racking / Singlefoot" },
    { value: "endurance", label: t("preq.style.endurance") },
    { value: "other", label: t("preq.style.other") },
  ];

  const USES = [
    { value: "training", label: t("preq.use.training") },
    { value: "competition", label: t("preq.use.competition") },
    { value: "long-distance", label: t("preq.use.longDistance") },
    { value: "technique", label: t("preq.use.technique") },
  ];

  const OUTPUT_PREFS = [
    { value: "short", label: t("preq.output.short") },
    { value: "recommendation", label: t("preq.output.recommendation") },
    { value: "overview", label: t("preq.output.overview") },
  ];

  const isValid = goal && style && use && outputPref.length > 0;

  const togglePref = (value: string) => {
    setOutputPref((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = () => {
    const parsed = questionnaireSchema.safeParse({
      primaryGoal: goal,
      targetStyle: style,
      primaryUse: use,
      outputPreference: outputPref,
      additionalInfo,
    });
    if (!parsed.success) return;
    onComplete(parsed.data as QuestionnaireAnswers);
  };

  const ArrowIcon = lang === "he" ? ChevronLeft : ChevronRight;

  return (
    <section className="py-4">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          {t("preq.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("preq.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-6" dir={dir}>
        {/* Q1: Goal */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t("preq.q1")}</Label>
          <RadioGroup value={goal} onValueChange={setGoal} className="space-y-1.5">
            {GOALS.map((g) => (
              <label key={g.value} className={`flex items-center gap-3 rounded-lg border p-2.5 min-h-11 cursor-pointer transition-colors ${goal === g.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <RadioGroupItem value={g.value} />
                <span className="text-sm">{g.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Q2: Style */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t("preq.q2")}</Label>
          <RadioGroup value={style} onValueChange={setStyle} className="grid grid-cols-2 gap-1.5">
            {STYLES.map((s) => (
              <label key={s.value} className={`flex items-center gap-2 rounded-lg border p-2.5 min-h-11 cursor-pointer transition-colors ${style === s.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <RadioGroupItem value={s.value} />
                <span className="text-sm">{s.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Q3: Use */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t("preq.q3")}</Label>
          <RadioGroup value={use} onValueChange={setUse} className="grid grid-cols-2 gap-1.5">
            {USES.map((u) => (
              <label key={u.value} className={`flex items-center gap-2 rounded-lg border p-2.5 min-h-11 cursor-pointer transition-colors ${use === u.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <RadioGroupItem value={u.value} />
                <span className="text-sm">{u.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Q4: Output preference (multi) */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t("preq.q4")}</Label>
          <div className="space-y-1.5">
            {OUTPUT_PREFS.map((p) => (
              <label key={p.value} className={`flex items-center gap-3 rounded-lg border p-2.5 min-h-11 cursor-pointer transition-colors ${outputPref.includes(p.value) ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <Checkbox
                  checked={outputPref.includes(p.value)}
                  onCheckedChange={() => togglePref(p.value)}
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Q5: Additional info (optional) */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t("preq.q5")}</Label>
          <Textarea
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder={t("preq.q5Placeholder")}
            rows={2}
          />
        </div>

        <Button onClick={handleSubmit} disabled={!isValid} className="w-full h-11 font-semibold">
          <ArrowIcon className="h-4 w-4 ml-2" />
          {t("preq.submit")}
        </Button>
      </CardContent>
    </section>
  );
}
