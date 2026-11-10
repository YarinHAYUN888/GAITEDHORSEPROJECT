import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle, SkipForward, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PipelineStageKey, PipelineStageStatus } from "@/services/gaitPipelineOrchestrator";
export type AnalysisStageKey = PipelineStageKey;
const labels: Record<string, [string, string]> = {
  frames: ["חילוץ תמונות", "Extracting frames"], audio: ["עיבוד שמע", "Processing audio"],
  vision: ["ניתוח וידאו AI", "AI video analysis"], keypoints: ["נקודות אנטומיות", "Anatomical keypoints"],
  metrics: ["מדדים קינמטיים", "Kinematic metrics"], "window-select": ["בחירת מקטעים", "Selecting windows"],
  biomech: ["חישוב ביומכני", "Biomechanical computation"], critic: ["בדיקת עקביות", "Consistency check"],
  merge: ["שילוב מקורות", "Combining sources"], conditions: ["סקרינינג לא אבחנתי", "Non-diagnostic screening"],
  saving: ["שמירת תוצאה", "Saving result"], done: ["הושלם", "Completed"]
};
export default function AnalysisProgress({ currentStage, stages }: { currentStage: PipelineStageKey; progress: number; stages?: PipelineStageStatus[] }) {
  const { lang } = useLanguage();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const items = stages?.filter(s => s.key !== "done") ?? [{ key: currentStage, status: "running" as const }];
  const complete = items.filter(s => ["done", "failed", "skipped"].includes(s.status)).length;
  return <section className="space-y-4 py-6" role="status" aria-label={lang === "he" ? "מצב הניתוח" : "Analysis status"}>
    <div className="flex justify-between items-center gap-3"><h2 className="font-semibold">{lang === "he" ? "מנתח את הסרטון" : "Analyzing your video"}</h2><span className="flex items-center gap-2 text-sm tabular-nums"><Clock className="h-4 w-4 text-primary" />{Math.floor((now-startedAt)/1000)}s</span></div>
    <Progress value={items.length ? complete / items.length * 100 : 0} />
    <p className="text-sm text-muted-foreground">{complete}/{items.length} {lang === "he" ? "שלבים הסתיימו" : "stages settled"}</p>
    <div className="grid gap-3 sm:grid-cols-2">{items.map(s => {
      const Icon = s.status === "running" ? Loader2 : s.status === "done" ? CheckCircle : s.status === "failed" ? XCircle : SkipForward;
      return <div key={s.key} className="flex gap-2 items-center text-sm"><Icon className={`h-4 w-4 shrink-0 ${s.status === "running" ? "animate-spin text-primary" : s.status === "failed" ? "text-destructive" : "text-muted-foreground"}`} /><span className="flex-1">{labels[s.key]?.[lang === "he" ? 0 : 1] ?? s.key}</span>{s.durationMs !== undefined && <span className="tabular-nums text-muted-foreground">{(s.durationMs/1000).toFixed(1)}s</span>}</div>;
    })}</div>
  </section>;
}
