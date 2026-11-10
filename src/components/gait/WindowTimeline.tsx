import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";
import type { GaitWindow } from "@/types/biomech";

interface WindowTimelineProps {
  windows: GaitWindow[];
  selectedIndices?: number[];
}

function qualityColor(q: number): string {
  if (q >= 0.7) return "bg-green-500";
  if (q >= 0.4) return "bg-yellow-500";
  return "bg-destructive";
}

function qualityBorder(q: number, selected: boolean): string {
  if (selected) return "ring-2 ring-primary ring-offset-1 ring-offset-background";
  return "";
}

const GAIT_LABELS: Record<string, string> = {
  diagonal: "טרוט",
  lateral: "פייס",
  singlefoot: "סינגלפוט",
  four_beat: "4-פעימות",
  broken_pace: "פייס שבור",
  unknown: "לא ידוע",
};

export default memo(function WindowTimeline({ windows, selectedIndices = [] }: WindowTimelineProps) {
  if (!windows.length) return null;

  const selectedSet = new Set(selectedIndices);
  const totalDuration = windows[windows.length - 1].endT - windows[0].startT;
  const qualityCount = windows.filter(w => w.quality >= 0.4).length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          ציר זמן — חלונות ניתוח
          <Badge variant="outline" className="mr-auto text-xs">
            {qualityCount}/{windows.length} איכותיים
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="flex gap-0.5 h-8 rounded-md overflow-hidden">
            {windows.map((w, i) => {
              const widthPct = totalDuration > 0
                ? ((w.endT - w.startT) / totalDuration) * 100
                : 100 / windows.length;
              const isSelected = selectedSet.has(i);

              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      className={`${qualityColor(w.quality)} ${qualityBorder(w.quality, isSelected)} rounded-sm cursor-default transition-all hover:brightness-110 relative`}
                      style={{ width: `${widthPct}%`, minWidth: "4px" }}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs space-y-1">
                    <p className="font-semibold">{GAIT_LABELS[w.classification.classification] || w.classification.classification}</p>
                    <p>ביטחון: {(w.classification.confidence * 100).toFixed(0)}%</p>
                    <p>איכות: {(w.quality * 100).toFixed(0)}%</p>
                    <p className="text-muted-foreground">{w.startT.toFixed(1)}s – {w.endT.toFixed(1)}s</p>
                    {isSelected && <p className="text-primary font-medium">✓ נבחר לניתוח</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Legend */}
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> אמין</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 inline-block" /> גבולי</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-destructive inline-block" /> לא אמין</span>
        </div>
      </CardContent>
    </Card>
  );
});
