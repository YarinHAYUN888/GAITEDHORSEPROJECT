import { memo } from "react";
import { AlertTriangle, ShieldCheck, Activity, Heart, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DetectConditionsResult } from "@/types/gait";

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: "bg-green-500/10", text: "text-green-600", border: "border-green-500/30" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-600", border: "border-yellow-500/30" },
  high: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/30" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
};

const RISK_LABELS: Record<string, string> = {
  low: "סיכון נמוך",
  medium: "סיכון בינוני",
  high: "סיכון גבוה",
  critical: "קריטי",
};

interface Props {
  conditions: DetectConditionsResult;
}

export default memo(function ConditionsPanel({ conditions }: Props) {
  const healthColor =
    conditions.overallHealthScore >= 80
      ? "text-green-500"
      : conditions.overallHealthScore >= 60
      ? "text-yellow-500"
      : conditions.overallHealthScore >= 40
      ? "text-orange-500"
      : "text-destructive";

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            סקירת סיכונים (כלי עזר)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">סקרינינג בלבד</Badge>
            <span className={`text-2xl font-bold ${healthColor}`}>{conditions.overallHealthScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <Progress value={conditions.overallHealthScore} className="h-2 mt-2" />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Vet review banner */}
        {conditions.requiresVetReview && (
          <Alert className="border-orange-500/30 bg-orange-500/5">
            <Stethoscope className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-sm font-medium text-orange-600">
              🩺 מומלץ בדיקת וטרינר — הממצאים מצריכים הערכה מקצועית
            </AlertDescription>
          </Alert>
        )}

        {/* Urgent alerts */}
        {conditions.alerts
          .filter((a) => a.severity === "high" || a.severity === "critical")
          .map((alert, i) => (
            <Alert key={i} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">{alert.message}</AlertDescription>
            </Alert>
          ))}

        {/* Conditions list */}
        {conditions.conditions.length > 0 ? (
          <div className="space-y-3">
            {conditions.conditions.map((cond, i) => {
              const colors = RISK_COLORS[cond.risk] || RISK_COLORS.low;
              return (
                <div key={i} className={`rounded-lg p-3 ${colors.bg} border ${colors.border} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className={`h-4 w-4 ${colors.text}`} />
                      <span className="font-medium text-sm text-foreground">{cond.name}</span>
                      <span className="text-xs text-muted-foreground">({cond.nameEn})</span>
                    </div>
                    <Badge variant="outline" className={`${colors.text} ${colors.border}`}>
                      {RISK_LABELS[cond.risk] || cond.risk}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">ביטחון:</span>
                    <Progress value={cond.confidence} className="h-1.5 w-20" />
                    <span className="text-xs text-muted-foreground">{cond.confidence}%</span>
                  </div>

                  {/* Objective metrics used */}
                  {cond.objectiveMetricsUsed && cond.objectiveMetricsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cond.objectiveMetricsUsed.map((m, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Structured evidence */}
                  {cond.structuredEvidence && cond.structuredEvidence.length > 0 && (
                    <div className="bg-background/50 rounded p-1.5 space-y-0.5">
                      {cond.structuredEvidence.map((ev, j) => (
                        <div key={j} className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="font-medium text-foreground/70">{ev.metric}:</span>
                          <span>{ev.value}{ev.unit ? ` ${ev.unit}` : ""}</span>
                          {ev.threshold && <span className="text-muted-foreground/60">(סף: {ev.threshold})</span>}
                          {ev.direction && <span className={ev.direction === "high" ? "text-orange-500" : ev.direction === "low" ? "text-blue-500" : "text-yellow-500"}>↕ {ev.direction}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {cond.evidence.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {cond.evidence.map((ev, j) => (
                        <li key={j} className="flex items-start gap-1">
                          <span className="shrink-0 mt-0.5">•</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {cond.recommendation && (
                    <p className="text-xs font-medium text-foreground/80">💡 {cond.recommendation}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600 py-4 justify-center">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium">לא זוהו מצבים חריגים</span>
          </div>
        )}

        {/* Immediate actions */}
        {conditions.immediateActions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">פעולות מומלצות:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {conditions.immediateActions.map((action, i) => (
                <li key={i}>• {action}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Medical disclaimer */}
        <p className="text-[10px] text-muted-foreground/60 text-center border-t border-border pt-2">
          ⚕️ כלי סקרינינג בלבד — אינו מחליף אבחון וטרינרי מקצועי. יש להתייעץ עם וטרינר לגבי כל ממצא.
        </p>
      </CardContent>
    </Card>
  );
});
