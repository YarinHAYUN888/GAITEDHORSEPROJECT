import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import type { KinematicMetrics } from "@/types/gait";

const legLabels: Record<string, string> = {
  FL: "קדמית שמאל",
  FR: "קדמית ימין",
  HL: "אחורית שמאל",
  HR: "אחורית ימין",
};

const stanceSwingConfig = {
  stance: { label: "דריכה (ms)", color: "hsl(var(--primary))" },
  swing: { label: "תנופה (ms)", color: "hsl(var(--muted-foreground))" },
};

const radarConfig = {
  frontLeft: { label: "קד' שמאל", color: "hsl(var(--primary))" },
  frontRight: { label: "קד' ימין", color: "hsl(210, 80%, 55%)" },
  hindLeft: { label: "אח' שמאל", color: "hsl(150, 60%, 45%)" },
  hindRight: { label: "אח' ימין", color: "hsl(30, 80%, 55%)" },
};

interface Props {
  metrics: KinematicMetrics;
}

export default function KinematicChart({ metrics }: Props) {
  const stanceSwingData = metrics.stanceDuration && metrics.swingDuration
    ? (["FL", "FR", "HL", "HR"] as const).map((leg) => ({
        leg: legLabels[leg],
        stance: metrics.stanceDuration![leg],
        swing: metrics.swingDuration![leg],
      }))
    : null;

  const stanceAsymmetry = metrics.stanceDuration
    ? {
        front: Math.abs(metrics.stanceDuration.FL - metrics.stanceDuration.FR) / Math.max(metrics.stanceDuration.FL, metrics.stanceDuration.FR) * 100,
        hind: Math.abs(metrics.stanceDuration.HL - metrics.stanceDuration.HR) / Math.max(metrics.stanceDuration.HL, metrics.stanceDuration.HR) * 100,
      }
    : null;

  const radarData = metrics.jointAngles
    ? (() => {
        const joints = ["shoulder", "carpus", "fetlock", "hip", "stifle"] as const;
        const jointLabels: Record<string, string> = { shoulder: "כתף", carpus: "שורש כף יד", fetlock: "מפרק עליון", hip: "ירך", stifle: "ברך" };
        return joints
          .filter((j) => {
            const fl = metrics.jointAngles!.frontLeft as any;
            const hl = metrics.jointAngles!.hindLeft as any;
            return (fl && fl[j] !== undefined) || (hl && hl[j] !== undefined);
          })
          .map((j) => ({
            joint: jointLabels[j] || j,
            frontLeft: (metrics.jointAngles!.frontLeft as any)?.[j] || 0,
            frontRight: (metrics.jointAngles!.frontRight as any)?.[j] || 0,
            hindLeft: (metrics.jointAngles!.hindLeft as any)?.[j] || 0,
            hindRight: (metrics.jointAngles!.hindRight as any)?.[j] || 0,
          }));
      })()
    : null;

  return (
    <div className="space-y-4">
      {metrics.strideLength && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">אורך צעד</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-xs text-muted-foreground">שמאל</p><p className="text-2xl font-bold text-foreground">{metrics.strideLength.left}<span className="text-sm text-muted-foreground"> ס"מ</span></p></div>
              <div><p className="text-xs text-muted-foreground">ימין</p><p className="text-2xl font-bold text-foreground">{metrics.strideLength.right}<span className="text-sm text-muted-foreground"> ס"מ</span></p></div>
              <div><p className="text-xs text-muted-foreground">אסימטריה</p><Badge variant={metrics.strideLength.asymmetryPercent > 10 ? "destructive" : "secondary"}>{metrics.strideLength.asymmetryPercent}%</Badge></div>
            </div>
          </CardContent>
        </Card>
      )}

      {stanceSwingData && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">זמני דריכה / תנופה (ms)</CardTitle>
              {stanceAsymmetry && (stanceAsymmetry.front > 15 || stanceAsymmetry.hind > 15) && (
                <Badge variant="destructive" className="text-xs">⚠️ אסימטריה &gt;15%</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stanceSwingConfig} className="h-[220px] w-full">
              <BarChart data={stanceSwingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="leg" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="stance" fill="var(--color-stance)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="swing" fill="var(--color-swing)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {radarData && radarData.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">זוויות מפרקים (מעלות)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={radarConfig} className="h-[280px] w-full">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="joint" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                <Radar name="קד' שמאל" dataKey="frontLeft" stroke="var(--color-frontLeft)" fill="var(--color-frontLeft)" fillOpacity={0.15} />
                <Radar name="קד' ימין" dataKey="frontRight" stroke="var(--color-frontRight)" fill="var(--color-frontRight)" fillOpacity={0.15} />
                <Radar name="אח' שמאל" dataKey="hindLeft" stroke="var(--color-hindLeft)" fill="var(--color-hindLeft)" fillOpacity={0.15} />
                <Radar name="אח' ימין" dataKey="hindRight" stroke="var(--color-hindRight)" fill="var(--color-hindRight)" fillOpacity={0.15} />
                <Legend />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {metrics.legLiftHeight && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">גובה הרמת רגל (ס"מ)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-center">
              {(["FL", "FR", "HL", "HR"] as const).map((leg) => (
                <div key={leg}><p className="text-xs text-muted-foreground">{legLabels[leg]}</p><p className="text-xl font-bold text-foreground">{metrics.legLiftHeight![leg]}</p></div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {metrics.overreachDistance !== undefined && metrics.overreachDistance !== null && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
          <span className="text-sm font-medium text-foreground">מרחק Overreach:</span>
          <Badge variant="outline">{metrics.overreachDistance} ס"מ</Badge>
        </div>
      )}

      {metrics.phaseLagMs && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Phase Lags (ms)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {metrics.phaseLagMs.lf_rh !== undefined && (
                <div><p className="text-xs text-muted-foreground">LF-RH (אלכסוני)</p><p className="text-xl font-bold text-foreground">{metrics.phaseLagMs.lf_rh}</p></div>
              )}
              {metrics.phaseLagMs.rf_lh !== undefined && (
                <div><p className="text-xs text-muted-foreground">RF-LH (אלכסוני)</p><p className="text-xl font-bold text-foreground">{metrics.phaseLagMs.rf_lh}</p></div>
              )}
              {metrics.phaseLagMs.lf_lh !== undefined && (
                <div><p className="text-xs text-muted-foreground">LF-LH (לטרלי)</p><p className="text-xl font-bold text-foreground">{metrics.phaseLagMs.lf_lh}</p></div>
              )}
              {metrics.phaseLagMs.rf_rh !== undefined && (
                <div><p className="text-xs text-muted-foreground">RF-RH (לטרלי)</p><p className="text-xl font-bold text-foreground">{metrics.phaseLagMs.rf_rh}</p></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {metrics.diagonalDissociationMs && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Diagonal Dissociation (ms)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              {metrics.diagonalDissociationMs.lf_rh !== undefined && (
                <div><p className="text-xs text-muted-foreground">LF-RH</p><p className="text-2xl font-bold text-foreground">{metrics.diagonalDissociationMs.lf_rh}</p></div>
              )}
              {metrics.diagonalDissociationMs.rf_lh !== undefined && (
                <div><p className="text-xs text-muted-foreground">RF-LH</p><p className="text-2xl font-bold text-foreground">{metrics.diagonalDissociationMs.rf_lh}</p></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
