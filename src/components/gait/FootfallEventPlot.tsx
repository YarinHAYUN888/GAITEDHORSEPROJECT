import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Footprints } from "lucide-react";
import type { HoofName, FootContactEvent } from "@/types/biomech";

interface FootfallEventPlotProps {
  contacts: Record<HoofName, FootContactEvent[]>;
  beatEvenness: number;
  footfallOrder: string;
}

const HOOF_Y_MAP: Record<HoofName, number> = {
  lf_hoof: 4,
  rf_hoof: 3,
  lh_hoof: 2,
  rh_hoof: 1,
};

const HOOF_LABELS: Record<HoofName, string> = {
  lf_hoof: "LF",
  rf_hoof: "RF",
  lh_hoof: "LH",
  rh_hoof: "RH",
};

function confColor(c: number): string {
  if (c >= 0.7) return "hsl(142, 71%, 45%)";
  if (c >= 0.5) return "hsl(48, 96%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function evennessLabel(e: number): { text: string; variant: "default" | "secondary" | "destructive" } {
  if (e >= 0.8) return { text: "אחיד מאוד", variant: "default" };
  if (e >= 0.6) return { text: "אחיד", variant: "secondary" };
  return { text: "לא אחיד", variant: "destructive" };
}

export default memo(function FootfallEventPlot({ contacts, beatEvenness, footfallOrder }: FootfallEventPlotProps) {
  const data = useMemo(() => {
    const points: Array<{ t: number; leg: number; conf: number; hoofName: string }> = [];
    for (const [hoof, events] of Object.entries(contacts)) {
      const y = HOOF_Y_MAP[hoof as HoofName];
      for (const ev of events) {
        points.push({ t: Math.round(ev.t * 100) / 100, leg: y, conf: ev.confidence, hoofName: HOOF_LABELS[hoof as HoofName] });
      }
    }
    return points;
  }, [contacts]);

  if (data.length === 0) return null;

  const evenness = evennessLabel(beatEvenness);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Footprints className="h-4 w-4 text-primary" />
          גרף נחיתות (Footfall Events)
          <Badge variant={evenness.variant} className="mr-auto text-xs">
            Beat Evenness: {(beatEvenness * 100).toFixed(0)}% — {evenness.text}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="t"
                type="number"
                name="זמן"
                unit="s"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                label={{ value: "זמן (שניות)", position: "bottom", offset: 5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                dataKey="leg"
                type="number"
                domain={[0.5, 4.5]}
                ticks={[1, 2, 3, 4]}
                tickFormatter={(v: number) => {
                  const map: Record<number, string> = { 4: "LF", 3: "RF", 2: "LH", 1: "RH" };
                  return map[v] || "";
                }}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                width={35}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-xs space-y-0.5">
                      <p className="font-semibold">{d.hoofName}</p>
                      <p>זמן: {d.t}s</p>
                      <p>ביטחון: {(d.conf * 100).toFixed(0)}%</p>
                    </div>
                  );
                }}
              />
              <Scatter data={data} shape="circle">
                {data.map((entry, i) => (
                  <Cell key={i} fill={confColor(entry.conf)} r={5} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>סדר נחיתה: <span className="font-mono font-semibold text-foreground">{footfallOrder}</span></span>
          <div className="flex gap-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(142, 71%, 45%)" }} /> גבוה</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(48, 96%, 53%)" }} /> בינוני</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(0, 84%, 60%)" }} /> נמוך</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
