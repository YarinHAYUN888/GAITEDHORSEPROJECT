import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Camera, AlertTriangle, CheckCircle, RotateCcw, MoveHorizontal, Zap } from "lucide-react";
import type { CameraMotionMetrics } from "@/types/biomech";
import { useLanguage } from "@/contexts/LanguageContext";

interface CameraQualityCardProps {
  metrics: CameraMotionMetrics;
}

function stabilityLabel(score: number, t: (k: string) => string): { text: string; variant: "default" | "secondary" | "destructive" } {
  if (score >= 0.7) return { text: t("camera.good"), variant: "default" };
  if (score >= 0.4) return { text: t("camera.moderate"), variant: "secondary" };
  return { text: t("camera.poor"), variant: "destructive" };
}

export default memo(function CameraQualityCard({ metrics }: CameraQualityCardProps) {
  const { t } = useLanguage();
  const stabilityPct = Math.round(metrics.cameraStabilityScore * 100);
  const label = stabilityLabel(metrics.cameraStabilityScore, t);

  const warningMap: Record<string, { icon: React.ReactNode; text: string }> = {
    camera_panning: {
      icon: <MoveHorizontal className="h-3.5 w-3.5 shrink-0" />,
      text: t("camera.warn.panning"),
    },
    circular_motion: {
      icon: <RotateCcw className="h-3.5 w-3.5 shrink-0" />,
      text: t("camera.warn.circular"),
    },
    shaky_camera: {
      icon: <Zap className="h-3.5 w-3.5 shrink-0" />,
      text: t("camera.warn.shaky"),
    },
    fast_camera_movement: {
      icon: <Zap className="h-3.5 w-3.5 shrink-0" />,
      text: t("camera.warn.fast"),
    },
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          {t("camera.title")}
          <Badge variant={label.variant} className="mr-auto">
            {label.text}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stability gauge */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              {stabilityPct >= 70
                ? <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                : <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />}
              {t("camera.stability")}
            </span>
            <span className="font-mono text-xs">{stabilityPct}%</span>
          </div>
          <Progress value={stabilityPct} className="h-1.5" />
        </div>

        {/* Speed estimate */}
        {metrics.estimatedSpeedBLS > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("camera.speed")}</span>
            <span className="font-mono">{metrics.estimatedSpeedBLS} BL/s</span>
          </div>
        )}

        {/* Panning fraction */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("camera.panFraction")}</span>
          <span className="font-mono">{Math.round(metrics.panningFraction * 100)}%</span>
        </div>

        {/* Angular velocity */}
        {metrics.angularVelocityDegS > 2 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("camera.angular")}</span>
            <span className="font-mono">{metrics.angularVelocityDegS}°/s</span>
          </div>
        )}

        {/* Warnings */}
        {metrics.warnings.filter(w => w !== "too_few_frames").length > 0 && (
          <div className="space-y-1.5 pt-1">
            {metrics.warnings
              .filter(w => warningMap[w])
              .map((w) => (
                <div key={w} className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-400">
                  {warningMap[w].icon}
                  <span>{warningMap[w].text}</span>
                </div>
              ))}
          </div>
        )}

        {/* Tip when score is low */}
        {metrics.cameraStabilityScore < 0.4 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{t("camera.tip")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
