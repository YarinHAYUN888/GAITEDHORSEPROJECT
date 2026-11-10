import { useState, useEffect } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Baby, BarChart3, GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type DetailLevel = "beginner" | "advanced" | "coach";

const STORAGE_KEY = "gait-detail-level";

interface Props {
  value: DetailLevel;
  onChange: (level: DetailLevel) => void;
}

export function useDetailLevel(): [DetailLevel, (v: DetailLevel) => void] {
  const [level, setLevel] = useState<DetailLevel>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "beginner" || saved === "advanced" || saved === "coach") return saved;
    return "beginner";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, level);
  }, [level]);

  return [level, setLevel];
}

export default function DetailLevelToggle({ value, onChange }: Props) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <span className="text-xs text-muted-foreground">{t("detail.label")}</span>
      <ToggleGroup type="single" value={value} onValueChange={(v) => v && onChange(v as DetailLevel)} size="sm">
        <ToggleGroupItem value="beginner" aria-label={t("detail.beginner")} className="gap-1 text-xs min-h-11">
          <Baby className="h-3.5 w-3.5" />
          {t("detail.beginner")}
        </ToggleGroupItem>
        <ToggleGroupItem value="advanced" aria-label={t("detail.advanced")} className="gap-1 text-xs min-h-11">
          <BarChart3 className="h-3.5 w-3.5" />
          {t("detail.advanced")}
        </ToggleGroupItem>
        <ToggleGroupItem value="coach" aria-label={t("detail.coach")} className="gap-1 text-xs min-h-11">
          <GraduationCap className="h-3.5 w-3.5" />
          {t("detail.coach")}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
