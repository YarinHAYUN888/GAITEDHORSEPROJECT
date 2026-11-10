import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, BarChart3, Zap, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import MiniSparkline from "./MiniSparkline";

interface GaitRow {
  id: string;
  horse_id: string | null;
  horse_name: string | null;
  overall_score: number | null;
  created_at: string;
}

interface SmartHighlightsProps {
  gaitAnalyses: GaitRow[];
  totalHorses: number;
  weeklyTrainings: number;
}

interface Insight {
  icon: React.ReactNode;
  text: string;
  sparkValues?: number[];
  color: string;
  type: "positive" | "negative" | "neutral";
}

export default function SmartHighlights({ gaitAnalyses, totalHorses, weeklyTrainings }: SmartHighlightsProps) {
  const { t } = useLanguage();

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeek = gaitAnalyses.filter(a => new Date(a.created_at) >= oneWeekAgo);
    const lastWeek = gaitAnalyses.filter(a => {
      const d = new Date(a.created_at);
      return d >= twoWeeksAgo && d < oneWeekAgo;
    });

    // Activity comparison
    if (lastWeek.length > 0) {
      const pctChange = Math.round(((thisWeek.length - lastWeek.length) / lastWeek.length) * 100);
      if (pctChange > 0) {
        result.push({
          icon: <Zap className="h-5 w-5" />,
          text: `${t("highlights.analysesUp") || "ניתוחים השבוע:"} ${thisWeek.length} — ${pctChange}% ${t("highlights.moreThanLastWeek") || "יותר מהשבוע שעבר"}`,
          color: "text-emerald-500",
          type: "positive",
        });
      } else if (pctChange < -20) {
        result.push({
          icon: <BarChart3 className="h-5 w-5" />,
          text: `${t("highlights.analysesDown") || "ירידה בפעילות:"} ${thisWeek.length} ${t("highlights.analysesThisWeek") || "ניתוחים השבוע"} (${Math.abs(pctChange)}% ${t("highlights.less") || "פחות"})`,
          color: "text-amber-500",
          type: "neutral",
        });
      }
    } else if (thisWeek.length > 0) {
      result.push({
        icon: <Zap className="h-5 w-5" />,
        text: `${thisWeek.length} ${t("highlights.newAnalyses") || "ניתוחים חדשים השבוע"} 🎉`,
        color: "text-emerald-500",
        type: "positive",
      });
    }

    // Score trend
    const recentScores = gaitAnalyses
      .filter(a => a.overall_score != null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-10)
      .map(a => a.overall_score!);

    if (recentScores.length >= 3) {
      const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
      const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = Math.round(avgSecond - avgFirst);

      if (diff > 3) {
        result.push({
          icon: <TrendingUp className="h-5 w-5" />,
          text: `${t("highlights.avgScoreUp") || "הציון הממוצע עלה ב-"}${diff} ${t("highlights.points") || "נקודות"}`,
          sparkValues: recentScores,
          color: "text-emerald-500",
          type: "positive",
        });
      } else if (diff < -3) {
        result.push({
          icon: <TrendingDown className="h-5 w-5" />,
          text: `${t("highlights.avgScoreDown") || "הציון הממוצע ירד ב-"}${Math.abs(diff)} ${t("highlights.points") || "נקודות"}`,
          sparkValues: recentScores,
          color: "text-red-500",
          type: "negative",
        });
      } else {
        result.push({
          icon: <Minus className="h-5 w-5" />,
          text: t("highlights.scoresStable") || "הציונים יציבים — עבודה נהדרת!",
          sparkValues: recentScores,
          color: "text-muted-foreground",
          type: "neutral",
        });
      }
    }

    // Per-horse declining trend
    const horseScores = new Map<string, { name: string; scores: number[] }>();
    gaitAnalyses
      .filter(a => a.horse_id && a.horse_name && a.overall_score != null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(a => {
        if (!horseScores.has(a.horse_id!)) {
          horseScores.set(a.horse_id!, { name: a.horse_name!, scores: [] });
        }
        horseScores.get(a.horse_id!)!.scores.push(a.overall_score!);
      });

    for (const [, horse] of horseScores) {
      if (horse.scores.length >= 3) {
        const last3 = horse.scores.slice(-3);
        if (last3.every((s, i) => i === 0 || s < last3[i - 1])) {
          result.push({
            icon: <AlertTriangle className="h-5 w-5" />,
            text: `${t("highlights.horseDecline") || "ירידה עקבית ל-"}${horse.name} — ${t("highlights.worthChecking") || "שווה לבדוק"}`,
            sparkValues: horse.scores.slice(-6),
            color: "text-amber-500",
            type: "negative",
          });
        }
      }
    }

    return result.slice(0, 4);
  }, [gaitAnalyses, t]);

  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {insights.map((insight, i) => (
        <Card
          key={i}
          className={`glass-card border-${insight.type === "negative" ? "destructive/30" : insight.type === "positive" ? "emerald-500/30" : "border"}`}
        >
          <CardContent className="flex items-center gap-3 py-4 px-4">
            <div className={`shrink-0 ${insight.color}`}>
              {insight.icon}
            </div>
            <p className="text-sm font-medium text-foreground flex-1 leading-snug">
              {insight.text}
            </p>
            {insight.sparkValues && (
              <MiniSparkline
                values={insight.sparkValues}
                color={
                  insight.type === "positive"
                    ? "hsl(var(--chart-2))"
                    : insight.type === "negative"
                    ? "hsl(var(--destructive))"
                    : "hsl(var(--muted-foreground))"
                }
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
