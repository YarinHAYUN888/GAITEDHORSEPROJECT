import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine, Legend as RLegend } from "recharts";
import { Footprints, TrendingUp, Timer, Activity, AlertTriangle, Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StrideSegmentationResult } from "@/types/stride";

const RATING_COLORS: Record<string, string> = {
  excellent: "hsl(var(--primary))",
  good: "hsl(142 71% 45%)",
  moderate: "hsl(38 92% 50%)",
  poor: "hsl(0 84% 60%)",
};

const RATING_BG: Record<string, string> = {
  excellent: "bg-primary/10 text-primary border-primary/30",
  good: "bg-green-500/10 text-green-600 border-green-500/30",
  moderate: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  poor: "bg-red-500/10 text-red-600 border-red-500/30",
};

function CVBadge({ cv, label }: { cv: number; label: string }) {
  const color = cv < 5 ? "bg-primary/10 text-primary" : cv < 10 ? "bg-green-500/10 text-green-600" : cv < 15 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="outline" className={`${color} text-[10px] font-mono`}>CV {cv.toFixed(1)}%</Badge>
    </div>
  );
}

export default memo(function StrideAnalysisCard({
  data,
}: {
  data: StrideSegmentationResult;
}) {
  const { t } = useLanguage();
  const { strides, consistency, reliable } = data;

  const chartData = useMemo(() =>
    strides.map((s, i) => {
      const deviation = Math.abs(s.durationMs - consistency.meanDurationMs) / (consistency.meanDurationMs || 1);
      return {
        name: `${i + 1}`,
        duration: s.durationMs,
        stance: s.stanceMs,
        swing: s.swingMs,
        duty: Math.round(s.dutyCycle * 100),
        confidence: s.confidence,
        isAnomaly: deviation > 0.15,
      };
    }),
    [strides, consistency.meanDurationMs]
  );

  // Best and worst strides
  const { bestIdx, worstIdx } = useMemo(() => {
    if (strides.length < 4) return { bestIdx: -1, worstIdx: -1 };
    let bestI = 0, worstI = 0;
    let minDev = Infinity, maxDev = 0;
    strides.forEach((s, i) => {
      const dev = Math.abs(s.durationMs - consistency.meanDurationMs);
      if (dev < minDev) { minDev = dev; bestI = i; }
      if (dev > maxDev) { maxDev = dev; worstI = i; }
    });
    return { bestIdx: bestI, worstIdx: worstI };
  }, [strides, consistency.meanDurationMs]);

  const anomalyCount = chartData.filter(d => d.isAnomaly).length;

  if (strides.length === 0) return null;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Footprints className="h-4 w-4 text-primary" />
            {t("stride.title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {anomalyCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {anomalyCount} {t("stride.anomalies")}
              </Badge>
            )}
            {!reliable && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                {t("stride.lowData")}
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] ${RATING_BG[consistency.rating]}`}>
              {t(`stride.rating.${consistency.rating}`)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{consistency.strideCount}</div>
                <div className="text-[10px] text-muted-foreground">{t("stride.count")}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("stride.countTip")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{consistency.meanDurationMs}<span className="text-xs text-muted-foreground">ms</span></div>
                <div className="text-[10px] text-muted-foreground">{t("stride.avgDuration")}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("stride.avgDurationTip")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{consistency.meanFrequencyHz}<span className="text-xs text-muted-foreground">Hz</span></div>
                <div className="text-[10px] text-muted-foreground">{t("stride.frequency")}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("stride.frequencyTip")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{Math.round(consistency.meanDutyCycle * 100)}%</div>
                <div className="text-[10px] text-muted-foreground">{t("stride.dutyCycle")}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("stride.dutyCycleTip")}</TooltipContent>
          </Tooltip>
        </div>

        {/* Consistency Score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {t("stride.consistencyScore")}
            </span>
            <span className="font-bold" style={{ color: RATING_COLORS[consistency.rating] }}>
              {consistency.score}/100
            </span>
          </div>
          <Progress value={consistency.score} className="h-2" />
        </div>

        {/* CV Breakdown */}
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-medium text-foreground flex items-center gap-1">
            <Activity className="h-3 w-3 text-primary" />
            {t("stride.variability")}
          </div>
          <CVBadge cv={consistency.durationCV} label={t("stride.durationCV")} />
          <CVBadge cv={consistency.stanceCV} label={t("stride.stanceCV")} />
          <CVBadge cv={consistency.swingCV} label={t("stride.swingCV")} />
          <CVBadge cv={consistency.dutyCycleCV} label={t("stride.dutyCycleCV")} />
        </div>

        {/* Stacked Bar Chart: Stance + Swing */}
        {strides.length >= 2 && (
          <div className="pt-2">
            <div className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
              <Timer className="h-3 w-3 text-primary" />
              {t("stride.perStrideChart")}
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    unit="ms"
                  />
                  <ReferenceLine
                    y={consistency.meanDurationMs}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <Bar dataKey="stance" stackId="stride" radius={[0, 0, 0, 0]} name="Stance">
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={`stance-${idx}`}
                        fill={entry.isAnomaly ? "hsl(0 84% 60%)" : "hsl(142 71% 45%)"}
                        fillOpacity={0.8}
                        stroke={idx === bestIdx ? "hsl(var(--primary))" : idx === worstIdx ? "hsl(0 84% 60%)" : "none"}
                        strokeWidth={idx === bestIdx || idx === worstIdx ? 2 : 0}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="swing" stackId="stride" radius={[4, 4, 0, 0]} name="Swing">
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={`swing-${idx}`}
                        fill={entry.isAnomaly ? "hsl(0 60% 70%)" : "hsl(217 91% 60%)"}
                        fillOpacity={0.6}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground mt-1">
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
                Stance
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: "hsl(217 91% 60%)" }} />
                Swing
              </div>
              {anomalyCount > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: "hsl(0 84% 60%)" }} />
                  {t("stride.anomaly")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Best vs Worst stride comparison */}
        {bestIdx >= 0 && worstIdx >= 0 && bestIdx !== worstIdx && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Trophy className="h-3.5 w-3.5" />
                {t("stride.bestStride")} #{bestIdx + 1}
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>{t("stride.avgDuration")}: {strides[bestIdx].durationMs}ms</div>
                <div>Duty: {Math.round(strides[bestIdx].dutyCycle * 100)}%</div>
              </div>
            </div>
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("stride.worstStride")} #{worstIdx + 1}
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>{t("stride.avgDuration")}: {strides[worstIdx].durationMs}ms</div>
                <div>Duty: {Math.round(strides[worstIdx].dutyCycle * 100)}%</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
