import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { BiomechMetrics } from "@/types/biomech";
import type { HeadPelvisMetrics, BackMetrics } from "@/types/gait";
import WindowTimeline from "@/components/gait/WindowTimeline";
import ClassificationExplainer from "@/components/gait/ClassificationExplainer";

interface Props {
  biomechMetrics?: BiomechMetrics;
  headPelvisMetrics?: HeadPelvisMetrics;
  backMetrics?: BackMetrics;
  criticWarnings?: string[];
}

const phaseLagConfig = {
  diagonal: { label: "אלכסוני (ms)", color: "hsl(var(--primary))" },
  lateral: { label: "לטרלי (ms)", color: "hsl(var(--muted-foreground))" },
};

function classifyDissociation(ms?: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (ms === undefined) return { label: "לא זמין", variant: "secondary" };
  if (ms < 10) return { label: "אלכסוני טהור", variant: "default" };
  if (ms < 30) return { label: "נטייה קלה ללטרלי", variant: "secondary" };
  return { label: "נטייה לטרלית", variant: "destructive" };
}

function classifyGait(classification?: string): string {
  switch (classification) {
    case "diagonal": return "אלכסוני (טרוט)";
    case "lateral": return "לטרלי (פייס)";
    case "four_beat": return "ארבע פעימות (טולט/הליכה)";
    case "singlefoot": return "סינגלפוט (4 פעימות לטרלי)";
    case "broken_pace": return "Broken Pace (פייס שבור)";
    default: return "לא ידוע";
  }
}

const REGULARITY_LABELS: Record<string, { label: string; color: string }> = {
  stable: { label: "יציב", color: "text-green-500" },
  moderate: { label: "בינוני", color: "text-amber-500" },
  irregular: { label: "לא סדיר", color: "text-destructive" },
};

const LEG_LABELS_HE: Record<string, string> = {
  frontLeft: "קדמית שמאל",
  frontRight: "קדמית ימין",
  hindLeft: "אחורית שמאל",
  hindRight: "אחורית ימין",
};

export default function BiomechChart({ biomechMetrics, headPelvisMetrics, backMetrics, criticWarnings }: Props) {
  // Use data from either biomechMetrics or direct props
  const timing = biomechMetrics?.timing;
  const headPelvis = headPelvisMetrics ?? biomechMetrics?.headPelvis;
  const back = backMetrics ?? biomechMetrics?.back;
  const gait = biomechMetrics?.gait;

  const phaseLagData = timing?.phaseLagMs ? [
    { pair: "LF-RH", diagonal: timing.phaseLagMs.lf_rh ?? 0, lateral: timing.phaseLagMs.lf_lh ?? 0 },
    { pair: "RF-LH", diagonal: timing.phaseLagMs.rf_lh ?? 0, lateral: timing.phaseLagMs.rf_rh ?? 0 },
  ] : null;

  const dissocLfRh = classifyDissociation(timing?.diagonalDissociationMs?.lf_rh);
  const dissocRfLh = classifyDissociation(timing?.diagonalDissociationMs?.rf_lh);

  const hasAnyData = timing || headPelvis || back || gait;
  if (!hasAnyData) return null;

  return (
    <div className="space-y-4">
      {/* Gait classification */}
      {gait && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">סיווג ביומכני של צעד</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="text-base px-3 py-1">{classifyGait(gait.classification)}</Badge>
              <span className="text-sm text-muted-foreground">ביטחון: {Math.round(gait.confidence * 100)}%</span>
              {gait.strideFrequencyHz && (
                <span className="text-sm text-muted-foreground">תדירות צעד: {gait.strideFrequencyHz} Hz</span>
              )}
            </div>

            {/* Confidence warning */}
            {gait.confidence < 0.6 && gait.confidence > 0 && (
              <div className="mt-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                ⚠️ רמת הוודאות נמוכה — מומלץ לצלם מחדש בזווית צד ברורה יותר
              </div>
            )}

            {/* Window votes breakdown */}
            {gait.windowVotes && gait.totalWindows !== undefined && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  הצבעת חלונות: {gait.qualityWindows ?? 0} איכותיים מתוך {gait.totalWindows}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(gait.windowVotes)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, weight]) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {classifyGait(type)} — {Math.round(weight * 100) / 100}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Classification explainer — why this gait type */}
      {gait && <ClassificationExplainer classification={gait} criticWarnings={criticWarnings} />}

      {/* Window timeline */}
      {biomechMetrics?.windows && biomechMetrics.windows.length > 0 && (
        <WindowTimeline windows={biomechMetrics.windows} />
      )}

      {/* Phase lags chart */}
      {phaseLagData && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Phase Lags — השהיות בין רגליים (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={phaseLagConfig} className="h-[180px] w-full">
              <BarChart data={phaseLagData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pair" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="diagonal" fill="var(--color-diagonal)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lateral" fill="var(--color-lateral)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-2">
              השהיה קרובה ל-0 בזוגות אלכסוניים = טרוט. בזוגות לטרליים = פייס. שניהם רחוקים מ-0 = טולט (ארבע פעימות).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diagonal dissociation */}
      {timing?.diagonalDissociationMs && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Diagonal Dissociation (Hobbs 2016)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">LF-RH</p>
                <p className="text-2xl font-bold text-foreground">{timing.diagonalDissociationMs.lf_rh ?? "—"}<span className="text-sm text-muted-foreground"> ms</span></p>
                <Badge variant={dissocLfRh.variant} className="mt-1">{dissocLfRh.label}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RF-LH</p>
                <p className="text-2xl font-bold text-foreground">{timing.diagonalDissociationMs.rf_lh ?? "—"}<span className="text-sm text-muted-foreground"> ms</span></p>
                <Badge variant={dissocRfLh.variant} className="mt-1">{dissocRfLh.label}</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              ערך נמוך = מגע אלכסוני סימולטני (טרוט). ערך גבוה = הפרדה בתזמון, מעיד על נטייה לטרלית.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stride regularity CV% */}
      {biomechMetrics?.strideRegularity && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stride Regularity — עקביות צעד (CV%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-bold text-foreground">{biomechMetrics.strideRegularity.overall}%</span>
              <Badge variant={biomechMetrics.strideRegularity.rating === "stable" ? "default" : biomechMetrics.strideRegularity.rating === "moderate" ? "secondary" : "destructive"}>
                {REGULARITY_LABELS[biomechMetrics.strideRegularity.rating]?.label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {Object.entries(biomechMetrics.strideRegularity.perLeg).map(([leg, cv]) => (
                <div key={leg} className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">{LEG_LABELS_HE[leg] ?? leg}</p>
                  <p className={`text-lg font-bold ${cv < 10 ? "text-green-500" : cv < 15 ? "text-amber-500" : "text-destructive"}`}>{cv}%</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">CV% נמוך מ-10% = צעד יציב. מעל 15% = חוסר עקביות.</p>
          </CardContent>
        </Card>
      )}

      {/* Head/Pelvis metrics */}
      {headPelvis && (headPelvis.headVerticalROM !== undefined || headPelvis.pelvisVerticalROM !== undefined) && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Head/Pelvis — תנועה אנכית (Rhodin)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {headPelvis.headVerticalROM !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">ROM ראש</p>
                  <p className="text-xl font-bold text-foreground">{(headPelvis.headVerticalROM * 100).toFixed(1)}<span className="text-sm text-muted-foreground">%</span></p>
                </div>
              )}
              {headPelvis.pelvisVerticalROM !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">ROM אגן</p>
                  <p className="text-xl font-bold text-foreground">{(headPelvis.pelvisVerticalROM * 100).toFixed(1)}<span className="text-sm text-muted-foreground">%</span></p>
                </div>
              )}
              {headPelvis.headPelvisPhaseLagMs !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Phase Lag ראש-אגן</p>
                  <p className="text-xl font-bold text-foreground">{headPelvis.headPelvisPhaseLagMs}<span className="text-sm text-muted-foreground"> ms</span></p>
                </div>
              )}
              {headPelvis.headVerticalAsymmetryIndex !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">א-סימטריה ראש</p>
                  <p className="text-xl font-bold text-foreground">{headPelvis.headVerticalAsymmetryIndex}</p>
                  {headPelvis.headVerticalAsymmetryIndex > 0.3 && (
                    <Badge variant="destructive" className="mt-1 text-xs">חשד לצליעה</Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back kinematics */}
      {back && (back.withersCroupROM !== undefined || back.backSlopeROM !== undefined || back.lateralSwayIndex !== undefined) && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Back Kinematics — קינמטיקת גב (van Weeren)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              {back.withersCroupROM !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Withers-Croup ROM</p>
                  <p className="text-xl font-bold text-foreground">{(back.withersCroupROM * 100).toFixed(2)}<span className="text-sm text-muted-foreground">%</span></p>
                </div>
              )}
              {back.backSlopeROM !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">שיפוע גב ROM</p>
                  <p className="text-xl font-bold text-foreground">{back.backSlopeROM}<span className="text-sm text-muted-foreground">°</span></p>
                </div>
              )}
              {back.lateralSwayIndex !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Lateral Sway</p>
                  <p className="text-xl font-bold text-foreground">{(back.lateralSwayIndex * 100).toFixed(2)}<span className="text-sm text-muted-foreground">%</span></p>
                  {back.lateralSwayIndex > 0.05 && (
                    <Badge variant="secondary" className="mt-1 text-xs">תנודה לטרלית גבוהה</Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
