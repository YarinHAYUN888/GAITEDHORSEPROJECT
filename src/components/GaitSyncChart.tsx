import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface BeatTrackerData {
  impactTimes: Array<{ leg: string; frameIndex: number; phase: string }>;
  offsetPercentage: number;
  isDirty: boolean;
  dirtyDescription: string;
}

const legLabels: Record<string, string> = {
  FL: "קדמית שמאל",
  FR: "קדמית ימין",
  HL: "אחורית שמאל",
  HR: "אחורית ימין",
};

const chartConfig = {
  stance: { label: "מגע (Stance)", color: "hsl(var(--primary))" },
  swing: { label: "אוויר (Swing)", color: "hsl(var(--muted-foreground))" },
};

export default function GaitSyncChart({ beatTracker }: { beatTracker: BeatTrackerData }) {
  // Group impacts by leg and create chart data
  const chartData = beatTracker.impactTimes.map((impact, i) => ({
    name: `F${impact.frameIndex}`,
    leg: legLabels[impact.leg] || impact.leg,
    value: impact.phase === "stance" ? 1 : 0.4,
    phase: impact.phase,
    fill: impact.phase === "stance" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
  }));

  // Create a summary by leg
  const legSummary = Object.entries(legLabels).map(([key, label]) => {
    const impacts = beatTracker.impactTimes.filter((t) => t.leg === key);
    const stanceCount = impacts.filter((t) => t.phase === "stance").length;
    return {
      leg: label,
      stanceFrames: stanceCount,
      swingFrames: impacts.length - stanceCount,
    };
  });

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          גרף פעימות הצעד (Beat Tracker)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart data={legSummary} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis dataKey="leg" type="category" width={100} tick={{ fontSize: 12 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="stanceFrames" name="stance" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            <Bar dataKey="swingFrames" name="swing" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>סטייה (Offset): {beatTracker.offsetPercentage}%</span>
          <span className={beatTracker.isDirty ? "text-destructive font-medium" : "text-green-500 font-medium"}>
            {beatTracker.isDirty ? "⚠️ צעד מלוכלך" : "✅ צעד נקי"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
