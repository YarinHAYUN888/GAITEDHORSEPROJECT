import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Weight, ArrowUpDown, ArrowLeftRight } from "lucide-react";
import type { GRFMetrics, HoofName } from "@/types/biomech";
import { useLanguage } from "@/contexts/LanguageContext";

interface GRFCardProps {
  metrics: GRFMetrics;
}

const HOOF_LABELS_HE: Record<HoofName, string> = {
  lf_hoof: "קדמית שמאל",
  rf_hoof: "קדמית ימין",
  lh_hoof: "אחורית שמאל",
  rh_hoof: "אחורית ימין",
};

const HOOF_LABELS_EN: Record<HoofName, string> = {
  lf_hoof: "Left Front",
  rf_hoof: "Right Front",
  lh_hoof: "Left Hind",
  rh_hoof: "Right Hind",
};

const HOOFS: HoofName[] = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];

function barColor(value: number, isOverloaded: boolean): string {
  if (isOverloaded) return "bg-destructive";
  if (value >= 0.8) return "bg-yellow-500";
  return "bg-primary";
}

export default memo(function GRFCard({ metrics }: GRFCardProps) {
  const { lang, t } = useLanguage();
  const hoofLabels = lang === "he" ? HOOF_LABELS_HE : HOOF_LABELS_EN;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Weight className="h-4 w-4 text-primary" />
          {t("grf.title")}
          {!metrics.reliable && (
            <Badge variant="secondary" className="mr-auto text-[10px]">{t("grf.lowData")}</Badge>
          )}
          {metrics.overloadDetected && (
            <Badge variant="destructive" className="mr-auto text-[10px]">{t("grf.overload")}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Per-limb force bars */}
        <div className="space-y-2">
          {HOOFS.map((hoof) => {
            const limb = metrics.perLimb[hoof];
            const isOverloaded = metrics.overloadedLimbs.includes(hoof);
            const impactPct = Math.round(limb.peakImpact * 100);
            const loadPct = Math.round(limb.meanStanceLoad * 100);

            return (
              <div key={hoof} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    {isOverloaded && <AlertTriangle className="h-3 w-3 text-destructive" />}
                    <span className={isOverloaded ? "text-destructive font-medium" : ""}>{hoofLabels[hoof]}</span>
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {t("grf.impact")}: {impactPct}% · {t("grf.load")}: {loadPct}%
                  </span>
                </div>
                <div className="flex gap-1">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor(limb.peakImpact, isOverloaded)}`} style={{ width: `${impactPct}%` }} />
                  </div>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor(limb.meanStanceLoad, isOverloaded)} opacity-70`} style={{ width: `${loadPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Distribution metrics */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3 w-3" />
              {t("grf.frontHind")}
            </div>
            <div className="flex items-center gap-2">
              <Progress value={metrics.frontHindRatio * 100} className="h-2 flex-1" />
              <span className="text-xs font-mono w-12 text-end">
                {Math.round(metrics.frontHindRatio * 100)}:{Math.round((1 - metrics.frontHindRatio) * 100)}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t("grf.front")}</span>
              <span>{t("grf.hind")}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowLeftRight className="h-3 w-3" />
              {t("grf.leftRight")}
            </div>
            <div className="flex items-center gap-2">
              <Progress value={(1 - metrics.leftRightAsymmetry) * 100} className="h-2 flex-1" />
              <span className="text-xs font-mono w-12 text-end">
                {Math.round((1 - metrics.leftRightAsymmetry) * 100)}%
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground text-center">
              {metrics.leftRightAsymmetry < 0.1 ? t("grf.symmetric") : metrics.leftRightAsymmetry < 0.25 ? t("grf.mildAsymmetry") : t("grf.significantAsymmetry")}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {metrics.warnings.filter(w => w !== "too_few_frames" && w !== "low_contact_count").map((w) => (
          <div key={w} className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{t(`grf.warn.${w}`)}</span>
          </div>
        ))}

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
          {t("grf.disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
});
