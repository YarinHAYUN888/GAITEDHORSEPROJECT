import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StrideSegmentationResult } from "@/types/stride";

const RATING_COLORS: Record<string, string> = {
  excellent: "hsl(var(--primary))",
  good: "hsl(142 71% 45%)",
  moderate: "hsl(38 92% 50%)",
  poor: "hsl(0 84% 60%)",
};

function cvToScore(cv: number): number {
  if (cv < 5) return 95;
  if (cv < 10) return 75;
  if (cv < 15) return 50;
  return 25;
}

export default memo(function StrideConsistencyCard({
  data,
}: {
  data: StrideSegmentationResult;
}) {
  const { t } = useLanguage();
  const { consistency, reliable, strides } = data;

  const radarData = useMemo(() => [
    { metric: t("stride.durationCV"), value: cvToScore(consistency.durationCV), cv: consistency.durationCV },
    { metric: t("stride.stanceCV"), value: cvToScore(consistency.stanceCV), cv: consistency.stanceCV },
    { metric: t("stride.swingCV"), value: cvToScore(consistency.swingCV), cv: consistency.swingCV },
    { metric: t("stride.dutyCycleCV"), value: cvToScore(consistency.dutyCycleCV), cv: consistency.dutyCycleCV },
  ], [consistency, t]);

  // Per-stride symmetry: compare left vs right duty cycles
  const symmetryScore = useMemo(() => {
    if (data.strideMetrics.length < 2) return null;
    const diffs: number[] = [];
    for (const sm of data.strideMetrics) {
      const lf = sm.perHoof["lf_hoof"]?.dutyCycle;
      const rf = sm.perHoof["rf_hoof"]?.dutyCycle;
      const lh = sm.perHoof["lh_hoof"]?.dutyCycle;
      const rh = sm.perHoof["rh_hoof"]?.dutyCycle;
      if (lf !== undefined && rf !== undefined) diffs.push(Math.abs(lf - rf));
      if (lh !== undefined && rh !== undefined) diffs.push(Math.abs(lh - rh));
    }
    if (diffs.length === 0) return null;
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return Math.max(0, Math.round((1 - avgDiff * 10) * 100));
  }, [data.strideMetrics]);

  if (strides.length < 2) return null;

  const avgCV = (consistency.durationCV + consistency.stanceCV + consistency.swingCV + consistency.dutyCycleCV) / 4;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t("consistency.title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!reliable && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                {t("stride.lowData")}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{
                color: RATING_COLORS[consistency.rating],
                borderColor: RATING_COLORS[consistency.rating] + "66",
              }}
            >
              {t(`stride.rating.${consistency.rating}`)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {t("consistency.overallScore")}
            </span>
            <span className="font-bold" style={{ color: RATING_COLORS[consistency.rating] }}>
              {consistency.score}/100
            </span>
          </div>
          <Progress value={consistency.score} className="h-2" />
        </div>

        {/* Radar Chart */}
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Radar
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{avgCV.toFixed(1)}%</div>
                <div className="text-[10px] text-muted-foreground">{t("consistency.avgCV")}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("consistency.avgCVTip")}</TooltipContent>
          </Tooltip>

          {symmetryScore !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <div className="text-lg font-bold text-foreground">{symmetryScore}</div>
                  <div className="text-[10px] text-muted-foreground">{t("consistency.symmetry")}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t("consistency.symmetryTip")}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/60">
          {t("consistency.explanation")}
        </p>
      </CardContent>
    </Card>
  );
});
