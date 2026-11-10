import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export function ScoreBar({ score, max = 10, label }: { score: number; max?: number; label: string }) {
  const pct = (score / max) * 100;
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-24 text-right">{label}</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-sm font-bold w-8">{score}/{max}</span>
    </div>
  );
}

export function MeasurementCard({ title, value, assessment, icon }: { title: string; value: string | number; assessment: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            <p className="text-lg font-bold text-primary">{typeof value === "number" ? `${value}°` : value}</p>
            <p className="text-xs text-muted-foreground mt-1">{assessment}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
