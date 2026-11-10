import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { format } from "date-fns";

interface DataPoint {
  date: string;
  score: number | null;
  symmetry: number | null;
  confidence: number | null;
  gaitType?: string | null;
}

interface Props {
  data: DataPoint[];
}

function movingAverage(values: (number | null)[], window = 3): (number | null)[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1).filter((v): v is number => v != null);
    return slice.length > 0 ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) : null;
  });
}

function computeTrend(values: number[]): "up" | "down" | "stable" {
  if (values.length < 2) return "stable";
  const recent = values.slice(-3);
  const earlier = values.slice(-6, -3);
  if (earlier.length === 0) {
    return recent[recent.length - 1] > recent[0] ? "up" : recent[recent.length - 1] < recent[0] ? "down" : "stable";
  }
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgEarlier = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const diff = avgRecent - avgEarlier;
  if (diff > 3) return "up";
  if (diff < -3) return "down";
  return "stable";
}

const TrendIcon = ({ trend }: { trend: "up" | "down" | "stable" }) => {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-primary" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export default function HorseTrendChart({ data }: Props) {
  const { t } = useLanguage();
  const [showSymmetry, setShowSymmetry] = useState(true);
  const [showConfidence, setShowConfidence] = useState(false);

  const chartData = useMemo(() => {
    const scores = data.map((d) => d.score);
    const symmetries = data.map((d) => d.symmetry);
    const ma = movingAverage(scores);
    const symMa = movingAverage(symmetries);

    return data.map((d, i) => ({
      date: format(new Date(d.date), "dd/MM"),
      fullDate: format(new Date(d.date), "dd/MM/yyyy"),
      score: d.score,
      symmetry: d.symmetry,
      confidence: d.confidence,
      scoreMA: ma[i],
      symmetryMA: symMa[i],
      gaitType: d.gaitType,
    }));
  }, [data]);

  const scoreTrend = useMemo(
    () => computeTrend(data.filter((d) => d.score != null).map((d) => d.score!)),
    [data]
  );

  const symmetryTrend = useMemo(
    () => computeTrend(data.filter((d) => d.symmetry != null).map((d) => d.symmetry!)),
    [data]
  );

  const avgScore = useMemo(() => {
    const valid = data.filter((d) => d.score != null).map((d) => d.score!);
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  }, [data]);

  const trendLabel = { up: t("trend.improving"), down: t("trend.declining"), stable: t("trend.stable") };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-sm space-y-1">
        <p className="font-medium">{point?.fullDate}</p>
        {point?.gaitType && (
          <Badge variant="secondary" className="text-xs">{point.gaitType}</Badge>
        )}
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium">{p.value ?? "—"}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t("trend.title")}
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Trend badges */}
            <div className="flex items-center gap-1.5">
              <TrendIcon trend={scoreTrend} />
              <span className="text-xs text-muted-foreground">{trendLabel[scoreTrend]}</span>
            </div>
            {avgScore != null && (
              <Badge variant="outline" className="text-xs">
                {t("trend.avg")}: {avgScore}
              </Badge>
            )}
          </div>
        </div>
        {/* Toggle buttons */}
        <div className="flex gap-2 mt-2">
          <Button
            variant={showSymmetry ? "secondary" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setShowSymmetry(!showSymmetry)}
          >
            {showSymmetry ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
            {t("hp.symmetry")}
          </Button>
          <Button
            variant={showConfidence ? "secondary" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setShowConfidence(!showConfidence)}
          >
            {showConfidence ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
            {t("trend.confidence")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="symGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={80} stroke="hsl(var(--primary)/0.3)" strokeDasharray="6 4" label={{ value: "80", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />

            {/* Score area + moving avg line */}
            <Area
              type="monotone"
              dataKey="score"
              name={t("hp.score")}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#scoreGrad)"
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="scoreMA"
              name={t("trend.movingAvg")}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              legendType="none"
            />

            {/* Symmetry */}
            {showSymmetry && (
              <>
                <Area
                  type="monotone"
                  dataKey="symmetry"
                  name={t("hp.symmetry")}
                  stroke="hsl(var(--accent))"
                  strokeWidth={1.5}
                  fill="url(#symGrad)"
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="symmetryMA"
                  name={`${t("hp.symmetry")} MA`}
                  stroke="hsl(var(--accent))"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  legendType="none"
                />
              </>
            )}

            {/* Confidence */}
            {showConfidence && (
              <Line
                type="monotone"
                dataKey="confidence"
                name={t("trend.confidence")}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={{ r: 2 }}
              />
            )}

            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>

      {/* Summary row */}
      <div className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{chartData[chartData.length - 1]?.score ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{t("trend.latest")}</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{avgScore ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{t("trend.avg")}</p>
        </div>
        <div className="text-center flex flex-col items-center">
          <div className="flex items-center gap-1">
            <TrendIcon trend={scoreTrend} />
            <span className="text-lg font-bold">{trendLabel[scoreTrend]}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("trend.scoreTrend")}</p>
        </div>
        <div className="text-center flex flex-col items-center">
          <div className="flex items-center gap-1">
            <TrendIcon trend={symmetryTrend} />
            <span className="text-lg font-bold">{trendLabel[symmetryTrend]}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("trend.symTrend")}</p>
        </div>
      </div>
    </Card>
  );
}
