import { useState } from "react";
import { Share2, ArrowUp, ArrowDown, Minus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import ShareableResultCard from "@/components/gait/ShareableResultCard";
import type { GaitAnalysisResult } from "@/types/gait";
interface Props { reference: GaitAnalysisResult; current: GaitAnalysisResult; referenceDate?: string; currentDate?: string; breedId?: string; }
export default function GaitComparisonView({ reference, current, referenceDate, currentDate }: Props) {
  const { lang } = useLanguage();
  const he = lang === "he";
  const [showShare, setShowShare] = useState(false);
  const metrics = [
    { label: "GES", before: reference.overallScore, after: current.overallScore },
    { label: "SI", before: reference.symmetry?.score, after: current.symmetry?.score },
    { label: "Lateral Sync %", before: reference.lateralSync?.percentage, after: current.lateralSync?.percentage },
    { label: he ? "ביטחון מודל" : "Model confidence", before: reference.confidence, after: current.confidence },
  ];
  const changedMode = reference.audioAnalysis !== undefined !== (current.audioAnalysis !== undefined);
  return <section className="space-y-6 py-6">
    <h2 className="text-xl font-semibold">{he ? "השוואת ניתוחים" : "Compare analyses"}</h2>
    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span>{he ? "בדיקת ייחוס" : "Reference"}: {referenceDate || "—"}</span><span>{he ? "בדיקה נוספת" : "Comparison"}: {currentDate || "—"}</span></div>
    <p className="flex gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0 text-primary" />{changedMode ? (he ? "מקורות המידע שונים בין הבדיקות." : "The analyses use different evidence sources.") : (he ? "שינויים בצילום ובמהירות עשויים להשפיע על SI ו־GES; ההבדלים אינם הוכחה לשיפור או הידרדרות." : "Filming and speed can affect SI and GES; differences do not prove improvement or deterioration.")}</p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{metrics.map(m => {
      const available = Number.isFinite(m.before) && Number.isFinite(m.after);
      const delta = available ? m.after - m.before : null;
      const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
      return <div key={m.label} className="border-t border-border pt-4 space-y-3"><h3 className="font-medium text-sm">{m.label}</h3><div className="flex items-center gap-3 text-xl font-semibold"><span>{m.before ?? "—"}</span><span className="text-muted-foreground">→</span><span>{m.after ?? "—"}</span></div><p className="flex items-center gap-1 text-primary"><Icon className="h-4 w-4" />{delta === null ? "—" : `${delta > 0 ? "+" : ""}${Math.round(delta*10)/10}`}</p></div>;
    })}</div>
    <div className="flex flex-wrap gap-3 items-center"><Badge variant="outline">{he ? reference.gaitTypeHebrew : reference.gaitType}</Badge>→<Badge variant="outline">{he ? current.gaitTypeHebrew : current.gaitType}</Badge></div>
    <Button variant="outline" className="min-h-11 gap-2" onClick={() => setShowShare(!showShare)}><Share2 className="h-4 w-4" />{he ? "שתפו תוצאה" : "Share result"}</Button>
    {showShare && <ShareableResultCard result={current} />}
  </section>;
}
