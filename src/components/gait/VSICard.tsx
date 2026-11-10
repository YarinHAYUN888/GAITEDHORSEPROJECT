import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Shield, Activity } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { HeadPelvisMetrics } from "@/types/biomech";

const AAEP_LABELS: Record<number, { he: string; color: string; bg: string }> = {
  0: { he: "תקין", color: "text-green-600", bg: "bg-green-500/10 border-green-500/30" },
  1: { he: "בקושי מורגש", color: "text-green-500", bg: "bg-green-500/10 border-green-500/30" },
  2: { he: "קשה לצפייה עקבית", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
  3: { he: "נצפה באופן עקבי", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30" },
  4: { he: "בולט — הנהון ראש", color: "text-red-500", bg: "bg-red-500/10 border-red-500/30" },
  5: { he: "נשיאת משקל מינימלית", color: "text-red-700", bg: "bg-red-500/10 border-red-500/30" },
};

const LEG_LABELS: Record<string, string> = {
  front: "קדמיות",
  hind: "אחוריות",
  both: "קדמיות + אחוריות",
};

function VSIGauge({ value, label, maxValue = 60 }: { value: number; label: string; maxValue?: number }) {
  const pct = Math.min(100, (value / maxValue) * 100);
  const color = value < 6 ? "hsl(var(--primary))" : value < 12 ? "hsl(142 71% 45%)" : value < 20 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/60">
        <span>0%</span>
        <span className="border-l border-dashed border-muted-foreground/30 px-1">6%</span>
        <span className="border-l border-dashed border-muted-foreground/30 px-1">20%</span>
        <span>{maxValue}%</span>
      </div>
    </div>
  );
}

export default memo(function VSICard({ metrics }: { metrics: HeadPelvisMetrics }) {
  const { t } = useLanguage();
  const { headVSI, pelvisVSI, lamenessGrade, lamenessLeg, vsiReliable } = metrics;

  if (headVSI === undefined && pelvisVSI === undefined) return null;

  const grade = lamenessGrade ?? 0;
  const gradeInfo = AAEP_LABELS[grade] ?? AAEP_LABELS[0];
  const isAlert = grade >= 2;

  return (
    <Card className={`glass-card ${isAlert ? "border-destructive/30" : "border-primary/20"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {isAlert ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Shield className="h-4 w-4 text-primary" />}
            {t("vsi.title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!vsiReliable && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                {t("vsi.lowData")}
              </Badge>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-[10px] ${gradeInfo.bg} ${gradeInfo.color}`}>
                  AAEP {grade}/5 — {gradeInfo.he}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t("vsi.aaepTip")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {headVSI !== undefined && (
          <VSIGauge value={headVSI} label={t("vsi.head")} />
        )}
        {pelvisVSI !== undefined && (
          <VSIGauge value={pelvisVSI} label={t("vsi.pelvis")} />
        )}

        {grade >= 1 && lamenessLeg && (
          <div className={`rounded-lg p-3 text-xs space-y-1 ${isAlert ? "bg-destructive/5 border border-destructive/20" : "bg-amber-500/5 border border-amber-500/20"}`}>
            <div className="flex items-center gap-1.5 font-medium">
              <Activity className="h-3 w-3" />
              {t("vsi.suspectedLameness")}
            </div>
            <p className="text-muted-foreground">
              {t("vsi.lamenessLeg")}: {LEG_LABELS[lamenessLeg] ?? lamenessLeg}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {t("vsi.disclaimer")}
            </p>
          </div>
        )}

        {grade === 0 && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {t("vsi.healthy")}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          {t("vsi.reference")}
        </p>
      </CardContent>
    </Card>
  );
});
