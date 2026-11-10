import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Activity } from "lucide-react";
import type { BackMetrics, HeadPelvisMetrics, BiomechMetrics } from "@/types/biomech";

interface Props {
  biomechMetrics?: BiomechMetrics;
  backMetrics?: BackMetrics;
  headPelvisMetrics?: HeadPelvisMetrics;
}

function MetricGauge({ label, value, unit, max, warningThreshold, description }: {
  label: string; value: number; unit: string; max: number; warningThreshold?: number; description?: string;
}) {
  const percent = Math.min(100, (value / max) * 100);
  const isWarning = warningThreshold !== undefined && value > warningThreshold;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className={`text-sm font-bold ${isWarning ? "text-destructive" : "text-foreground"}`}>
          {value.toFixed(2)} {unit}
        </span>
      </div>
      <Progress value={percent} className={`h-2 ${isWarning ? "[&>div]:bg-destructive" : ""}`} />
      {isWarning && (
        <div className="flex items-center gap-1 text-destructive">
          <AlertTriangle className="h-3 w-3" />
          <span className="text-[10px]">{description || "ערך חריג"}</span>
        </div>
      )}
    </div>
  );
}

export default memo(function WholeBodyBiomechPanel({ biomechMetrics, backMetrics, headPelvisMetrics }: Props) {
  const back = biomechMetrics?.back ?? backMetrics;
  const hp = biomechMetrics?.headPelvis ?? headPelvisMetrics;
  const spinal = biomechMetrics?.spinal;

  if (!back && !hp && !spinal) return null;

  // Compute spinal coupling ratio (flexion/lateral relationship)
  const couplingRatio = spinal?.couplingRatio ??
    (back?.backSlopeROM && back?.lateralSwayIndex && back.lateralSwayIndex > 0
      ? Math.round((back.backSlopeROM / (back.lateralSwayIndex * 100)) * 100) / 100
      : undefined);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          מדדי Whole-Body — כל הגוף
          <Badge variant="outline" className="text-[10px]">מבוסס מאמר CT</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Back metrics */}
          {back?.backSlopeROM !== undefined && (
            <MetricGauge
              label="טווח שיפוע גב (Back Slope ROM)"
              value={back.backSlopeROM}
              unit="°"
              max={15}
              warningThreshold={10}
              description="שיפוע גב גדול — בדוק התאמת אוכף"
            />
          )}

          {back?.lateralSwayIndex !== undefined && (
            <MetricGauge
              label="נדנוד צדדי (Lateral Sway)"
              value={back.lateralSwayIndex}
              unit=""
              max={0.15}
              warningThreshold={0.08}
              description="נדנוד צדדי מוגבר — ייתכן כאב גב"
            />
          )}

          {back?.withersCroupROM !== undefined && (
            <MetricGauge
              label="הפרש ROM שכם-אגן"
              value={back.withersCroupROM}
              unit=""
              max={0.1}
              warningThreshold={0.05}
              description="הפרש גדול — אסימטריה בתנועת הגב"
            />
          )}

          {/* Head/Pelvis */}
          {hp?.headVerticalAsymmetryIndex !== undefined && (
            <MetricGauge
              label="אסימטריה אנכית ראש"
              value={hp.headVerticalAsymmetryIndex}
              unit=""
              max={1}
              warningThreshold={0.3}
              description="אסימטריה גבוהה — סימן אפשרי לצליעה קדמית"
            />
          )}

          {hp?.headPelvisPhaseLagMs !== undefined && (
            <MetricGauge
              label="פיגור ראש-אגן"
              value={hp.headPelvisPhaseLagMs}
              unit="ms"
              max={200}
              warningThreshold={120}
              description="פיגור גדול — חוסר תיאום head-pelvis"
            />
          )}

          {/* Spinal coupling */}
          {couplingRatio !== undefined && (
            <MetricGauge
              label="יחס צימוד שדרתי (Spinal Coupling)"
              value={couplingRatio}
              unit=""
              max={5}
              warningThreshold={3}
              description="צימוד גבוה — כיפוף ונדנוד מתואמים חריג"
            />
          )}

          {/* Rib cage expansion */}
          {spinal?.ribCageExpansionIndex !== undefined && (
            <MetricGauge
              label="מדד התרחבות בית חזה"
              value={spinal.ribCageExpansionIndex}
              unit=""
              max={1}
              warningThreshold={0.2}
              description="התרחבות נמוכה — בדוק מערכת נשימתית"
            />
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          מדדים אלו מחושבים מתנועת נקודות מפתח (שכם, אגן, ראש) ומשקפים את תפקוד כל הגוף — לא רק הגפיים.
          מבוסס על van Weeren, Rhodin/PLOS, ומודל CT שלד מלא.
        </p>
      </CardContent>
    </Card>
  );
});
