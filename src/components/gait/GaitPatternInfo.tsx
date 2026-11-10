import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { getGaitMeta, type GaitMeta } from "@/lib/gaitCalculations";

interface Props {
  gaitType?: string;
}

const TENDENCY_COLORS: Record<string, string> = {
  lateral: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  diagonal: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  even: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

const TENDENCY_LABELS: Record<string, string> = {
  lateral: "לטרלי",
  diagonal: "אלכסוני",
  even: "שווה",
};

/** Compact gait info badges for gaited horse visualization */
export default memo(function GaitPatternInfo({ gaitType }: Props) {
  const meta = getGaitMeta(gaitType);
  if (!meta) return null;

  return (
    <div className="flex flex-col items-center gap-1.5 mt-2">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/40 text-primary">
          {meta.nameHe} / {meta.nameEn}
        </Badge>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${TENDENCY_COLORS[meta.tendency]}`}>
          {meta.beats} פעימות • {TENDENCY_LABELS[meta.tendency]}
        </Badge>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${meta.hasSuspension ? "bg-sky-500/20 text-sky-300 border-sky-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}>
          {meta.hasSuspension ? "עם ריחוף" : "ללא ריחוף"}
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground text-center max-w-xs">{meta.description}</p>
    </div>
  );
});
