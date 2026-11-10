import { CheckCircle, AlertTriangle, TrendingUp, Info, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GaitAnalysisResult } from "@/types/gait";
import { useLanguage } from "@/contexts/LanguageContext";

const riskColors: Record<string, string> = {
  none: "text-green-500",
  low: "text-yellow-500",
  moderate: "text-orange-500",
  high: "text-destructive",
};

interface MotionMetricsCardsProps {
  result: GaitAnalysisResult;
  analysisMode: "vision" | "audio" | "both";
}

export default function MotionMetricsCards({ result, analysisMode }: MotionMetricsCardsProps) {
  const { t } = useLanguage();
  const qualityLabels: Record<string, string> = {
    poor: t("motion.qualityPoor"),
    fair: t("motion.qualityFair"),
    good: t("motion.qualityGood"),
    excellent: t("motion.qualityExcellent"),
  };
  const riskLabels: Record<string, string> = {
    none: t("motion.riskNone"),
    low: t("motion.riskLow"),
    moderate: t("motion.riskModerate"),
    high: t("motion.riskHigh"),
  };
  if (analysisMode === "audio") {
    return (
      <Card className="glass-card border-muted">
        <CardContent className="py-6 text-center">
          <Eye className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("motion.audioOnlyNote")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            {t("score.labelLateralSync")}
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent><p className="text-xs max-w-[200px]">{t("score.tooltipLateralSync")}</p></TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3"><Progress value={result.lateralSync.percentage} className="h-3 flex-1" /><span className="text-sm font-bold">{result.lateralSync.percentage}%</span></div>
          <p className="text-sm text-muted-foreground">{result.lateralSync.description}</p>
          {result.beatTracker.isDirty && (
            <div className="flex items-center gap-2 bg-destructive/10 rounded-lg p-3"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-sm text-destructive font-medium">{t("motion.dirtyBeat").replace("{pct}", String(result.beatTracker.offsetPercentage))}</span></div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            {t("score.labelSI")}
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent><p className="text-xs max-w-[200px]">{t("motion.tooltipSI")}</p></TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3"><Progress value={result.symmetry.score} className="h-3 flex-1" /><span className="text-sm font-bold">{result.symmetry.score}/100</span></div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{t("motion.rightLeftDiff")}</span>
            <Badge variant={result.symmetry.leftRightDifference > 3 ? "destructive" : "secondary"}>{result.symmetry.leftRightDifference}°</Badge>
          </div>
          <div className="flex items-center gap-2">
            {result.symmetry.lamenessRisk === "none" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertTriangle className={`h-4 w-4 ${riskColors[result.symmetry.lamenessRisk]}`} />}
            <span className={`text-sm font-medium ${riskColors[result.symmetry.lamenessRisk]}`}>{riskLabels[result.symmetry.lamenessRisk]}</span>
          </div>
          <p className="text-sm text-muted-foreground">{result.symmetry.lamenessDescription}</p>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />{t("motion.extensionTitle")}
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent><p className="text-xs max-w-[200px]">{t("motion.tooltipExtension")}</p></TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-xs text-muted-foreground">{t("motion.frontLegs")}</span><p className="text-2xl font-bold text-foreground">{result.extension.frontLegs}°</p></div>
            <div><span className="text-xs text-muted-foreground">{t("motion.hindLegs")}</span><p className="text-2xl font-bold text-foreground">{result.extension.hindLegs}°</p></div>
          </div>
          <Badge variant="outline">{qualityLabels[result.extension.quality] || result.extension.quality}</Badge>
          <p className="text-sm text-muted-foreground">{result.extension.description}</p>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("motion.beatPattern")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Badge className="text-base">{result.beatPattern}</Badge>
          <p className="text-sm text-muted-foreground">{result.beatTracker.dirtyDescription}</p>
        </CardContent>
      </Card>
    </div>
  );
}
