import { Trophy, TrendingUp, Minus, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PercentileResult } from "@/data/gaitBenchmarks";

const RANK_CONFIG: Record<number, { icon: typeof Trophy; color: string; bg: string }> = {
  95: { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  75: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
  50: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/50" },
  25: { icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
};

interface GaitBenchmarkCardProps {
  results: PercentileResult[];
  breedNameHe: string;
  gaitTypeHe: string;
}

export default function GaitBenchmarkCard({ results, breedNameHe, gaitTypeHe }: GaitBenchmarkCardProps) {
  if (results.length === 0) return null;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          השוואה לתקן — {breedNameHe} ({gaitTypeHe})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((r) => {
          const config = RANK_CONFIG[r.percentileRank] || RANK_CONFIG[50];
          const Icon = config.icon;
          return (
            <div key={r.metric} className={`flex items-center justify-between rounded-lg p-3 ${config.bg}`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <span className="text-sm font-medium">{r.metricHe}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{typeof r.value === "number" && r.value % 1 !== 0 ? r.value.toFixed(2) : r.value}</span>
                <Badge className={`${config.color} border-current`} variant="outline">
                  {r.percentileLabel}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
