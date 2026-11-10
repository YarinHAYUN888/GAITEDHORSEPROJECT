import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Eye, Volume2, Info, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { EnrichedGaitResult } from "@/types/gait";

export default function OwnerEvidenceSummary({ result, videoFile, analysisId }: { result: EnrichedGaitResult; videoFile?: File | null; analysisId?: string }) {
  const { lang } = useLanguage();
  const he = lang === "he";
  const videoUrl = useMemo(() => videoFile ? URL.createObjectURL(videoFile) : null, [videoFile]);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  return <section className="border-b border-border pb-6 space-y-4" aria-label={he ? "ראיות ומגבלות" : "Evidence and limitations"}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{he ? "מה תומך בתוצאה?" : "What supports this result?"}</h2>
      <Badge variant="outline">{analysisId ? (he ? "נשמר בהיסטוריה" : "Saved to history") : (he ? "טרם נשמר" : "Not saved yet")}</Badge>
    </div>
    {result.processingTimeMs !== undefined && <p className="text-sm text-muted-foreground">{he ? "זמן עיבוד" : "Processing time"}: {(result.processingTimeMs / 1000).toFixed(1)}s</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3 text-sm">
        {result.sourceSelection && <p className="text-muted-foreground">{he ? "בחירת מקורות אוטומטית" : "Automatic source selection"}: {result.sourceSelection.reason}</p>}
        <p className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" />{result.sourceSelection?.visionUsed === false ? (he ? "וידאו — איכות לא מספקת" : "Video — insufficient quality") : (he ? "וידאו — הערכת AI" : "Video — AI estimate")}</p>
        <p className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-primary" />{result.audioAnalysis ? (he ? "שמע — ניתוח קצב זמין" : "Audio — rhythm analysis available") : (he ? "שמע — לא זמין" : "Audio — unavailable")}</p>
        <p className="text-muted-foreground">{he ? "ביטחון המודל אינו אחוז דיוק שנמדד מול מומחה." : "Model confidence is not accuracy measured against expert labels."}</p>
        <p className="text-muted-foreground">{he ? "SI ו־GES דורשים ראיות וידאו; קצב אקוסטי אינו אימות של נקישות פרסות או תזמון דריכות." : "SI and GES require video evidence; acoustic rhythm does not verify hoof strikes or contact timing."}</p>
        {result.multiModalFusion?.agreement === false && <p className="text-destructive">{he ? "הווידאו והשמע אינם מסכימים — יש לפרש בזהירות." : "Video and audio disagree — interpret with caution."}</p>}
        {result.explainability?.evidenceFor?.slice(0, 3).map((item, i) => <p key={i} className="text-muted-foreground">{item.reason}</p>)}
        {result.explainability?.evidenceAgainst?.slice(0, 2).map((item, i) => <p key={i} className="text-destructive">{item.reason}</p>)}
      </div>
      {videoUrl ? <video src={videoUrl} controls playsInline className="w-full aspect-video object-contain bg-muted rounded-lg" /> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0" />{he ? "הסרטון המקורי אינו זמין בתוצאה השמורה." : "The original video is unavailable in this saved result."}</div>}
    </div>
    <Button asChild variant="link" className="px-0 min-h-11"><Link to="/methodology">{he ? "מקורות מחקר ומגבלות" : "Research sources and limitations"}<ArrowUpRight className="h-4 w-4 ms-2" /></Link></Button>
  </section>;
}