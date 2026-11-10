import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";
import type { WindowQualityMetrics } from "@/types/biomech";

interface QualityMeterProps {
  windows: WindowQualityMetrics[];
  selectedCount?: number;
  totalCount?: number;
}

function ratingColor(score: number): string {
  if (score >= 0.7) return "text-green-600 dark:text-green-400";
  if (score >= 0.4) return "text-yellow-600 dark:text-yellow-400";
  return "text-destructive";
}

function ratingBg(score: number): string {
  if (score >= 0.7) return "bg-green-500/20";
  if (score >= 0.4) return "bg-yellow-500/20";
  return "bg-destructive/20";
}

function ratingIcon(score: number) {
  if (score >= 0.7) return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (score >= 0.4) return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export default memo(function QualityMeter({ windows, selectedCount, totalCount }: QualityMeterProps) {
  if (!windows.length) return null;

  const avgBlur = mean(windows.map(w => w.blurProxy));
  const avgCamera = mean(windows.map(w => w.cameraMotion));
  const avgStability = mean(windows.map(w => w.horseStability));
  const avgMissing = mean(windows.map(w => w.missingPct));

  // Compute overall score (0-100)
  const blurScore = Math.max(0, 100 - avgBlur * 200);
  const cameraScore = Math.max(0, 100 - avgCamera * 150);
  const stabilityScore = avgStability * 100;
  const occlusionScore = Math.max(0, 100 - avgMissing * 200);
  const overall = (blurScore * 0.25 + cameraScore * 0.25 + stabilityScore * 0.25 + occlusionScore * 0.25);
  const overallNorm = Math.max(0, Math.min(100, Math.round(overall)));

  const items = [
    { label: "חדות (Blur)", score: blurScore / 100, detail: `${(avgBlur * 100).toFixed(1)}%` },
    { label: "יציבות מצלמה", score: cameraScore / 100, detail: `${(avgCamera * 100).toFixed(1)}%` },
    { label: "סוס בפריים", score: stabilityScore / 100, detail: `${(avgStability * 100).toFixed(0)}%` },
    { label: "הסתרות (Occlusion)", score: occlusionScore / 100, detail: `${(avgMissing * 100).toFixed(1)}% חסרים` },
  ];

  const overallColor = overallNorm >= 70 ? "text-green-600 dark:text-green-400" : overallNorm >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-destructive";

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          מד איכות קלט
          <Badge variant="outline" className={`mr-auto ${ratingBg(overallNorm / 100)}`}>
            <span className={overallColor}>{overallNorm}/100</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                {ratingIcon(item.score)}
                {item.label}
              </span>
              <span className={`font-mono ${ratingColor(item.score)}`}>{item.detail}</span>
            </div>
            <Progress value={Math.max(0, Math.min(100, item.score * 100))} className="h-1.5" />
          </div>
        ))}

        {selectedCount !== undefined && totalCount !== undefined && (
          <div className="pt-1 text-xs text-muted-foreground text-center">
            {selectedCount}/{totalCount} חלונות נבחרו לניתוח
          </div>
        )}

        {overallNorm < 40 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>איכות הצילום נמוכה — מומלץ לצלם מחדש מזווית צד, עם תאורה טובה ומצלמה יציבה.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
