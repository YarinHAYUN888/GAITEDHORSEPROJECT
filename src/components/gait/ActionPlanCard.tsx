import { Link } from "react-router-dom";
import { Target, Music, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GaitAnalysisResult } from "@/types/gait";
import type { DetailLevel } from "./DetailLevelToggle";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  result: GaitAnalysisResult;
  detailLevel: DetailLevel;
}

function buildMeasurableGoals(result: GaitAnalysisResult): Array<{ label: string; current: number; target: number; unit: string }> {
  const goals: Array<{ label: string; current: number; target: number; unit: string }> = [];

  if (result.symmetry.score < 85) {
    goals.push({ label: "סימטריה", current: result.symmetry.score, target: Math.min(result.symmetry.score + 10, 95), unit: "%" });
  }

  const evenness = result.biomechMetrics?.windows?.[0]?.features?.beatEvenness;
  if (evenness !== undefined && evenness < 0.85) {
    goals.push({ label: "Beat Evenness", current: Math.round(evenness * 100), target: Math.min(Math.round(evenness * 100) + 10, 95), unit: "%" });
  }

  if (result.lateralSync.percentage < 80) {
    goals.push({ label: "סינכרון לטרלי", current: result.lateralSync.percentage, target: Math.min(result.lateralSync.percentage + 10, 95), unit: "%" });
  }

  return goals;
}

export default function ActionPlanCard({ result, detailLevel }: Props) {
  const { t } = useLanguage();
  const top3 = result.trainingRecommendations.slice(0, 3);
  const goals = buildMeasurableGoals(result);
  const bpm = result.audioAnalysis?.detectedBPM;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          {t("action.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top 3 actions */}
        <ol className="space-y-2">
          {top3.map((rec, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <Badge variant="outline" className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </Badge>
              <span>{typeof rec === "string" ? rec : (rec as any)?.title ?? (rec as any)?.description ?? JSON.stringify(rec)}</span>
            </li>
          ))}
        </ol>

        {/* Measurable goals */}
        {goals.length > 0 && detailLevel !== "beginner" && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {t("action.goals")}
            </p>
            <div className="grid gap-2">
              {goals.map((g, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2">
                  <span className="font-medium">{g.label}</span>
                  <span className="text-muted-foreground">
                    {g.current}{g.unit} → <span className="text-primary font-semibold">{g.target}{g.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metronome link */}
        {bpm && (
          <Link to={`/metronome?bpm=${Math.round(bpm)}`}>
            <Button variant="outline" size="sm" className="w-full gap-2 mt-1">
              <Music className="h-4 w-4" />
              {t("action.metronome")} ({Math.round(bpm)} BPM)
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
