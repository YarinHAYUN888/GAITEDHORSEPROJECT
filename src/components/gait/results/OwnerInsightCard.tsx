import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Ruler, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GaitAnalysisResult } from "@/types/gait";
import { buildSummary, trendOf, type PreviousAnalysis, type Trend } from "@/lib/ownerInsight";

function TrendIcon({ trend }: { trend: Trend | null }) {
  if (trend === "up") return <ArrowUp className="h-4 w-4 text-primary" />;
  if (trend === "down") return <ArrowDown className="h-4 w-4 text-destructive" />;
  if (trend === "flat") return <Minus className="h-4 w-4 text-muted-foreground" />;
  return null;
}

export default function OwnerInsightCard({ result, horseName, analysisId }: { result: GaitAnalysisResult; horseName?: string; analysisId?: string }) {
  const { lang } = useLanguage();
  const he = lang === "he";
  const [prev, setPrev] = useState<PreviousAnalysis | null>(null);

  useEffect(() => {
    if (!horseName) return;
    let cancelled = false;
    let q = supabase.from("gait_analyses").select("id, symmetry_score, lateral_sync_pct, created_at")
      .eq("horse_name", horseName).order("created_at", { ascending: false }).limit(2);
    q.then(({ data }) => {
      if (cancelled || !data) return;
      const row = data.find((r) => r.id !== analysisId);
      if (row) setPrev({ symmetry: row.symmetry_score, lateralSync: row.lateral_sync_pct, createdAt: row.created_at });
    });
    return () => { cancelled = true; };
  }, [horseName, analysisId]);

  const symmetry = result.symmetry?.score ?? 0;
  const sync = result.lateralSync?.percentage ?? 0;
  const summary = buildSummary({ gaitType: result.gaitType, symmetry, lateralSync: sync, confidence: result.confidence ?? 0 }, lang);
  const rows = [
    { label: he ? "סימטריה (SI)" : "Symmetry (SI)", value: symmetry, prev: prev?.symmetry },
    { label: he ? "סנכרון צידי %" : "Lateral Sync %", value: sync, prev: prev?.lateralSync },
  ];

  return (
    <Card className="glass-card border-primary/30">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-base font-semibold leading-relaxed text-foreground">{summary}</p>
        </div>

        {prev && (
          <div className="rounded-lg bg-muted/40 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {he ? "השוואה לניתוח הקודם" : "Compared with previous analysis"} · {new Date(prev.createdAt).toLocaleDateString(he ? "he-IL" : "en-GB")}
            </p>
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span>{r.label}</span>
                <span className="flex items-center gap-2 font-mono">
                  {r.prev ?? "—"} → {Math.round(r.value)} <TrendIcon trend={trendOf(r.value, r.prev)} />
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <div className="rounded-lg border border-border p-3">
            <p className="font-semibold flex items-center gap-1.5 mb-1"><Ruler className="h-3.5 w-3.5" />{he ? "מה נמדד" : "What was measured"}</p>
            <p className="text-muted-foreground">{he ? "תזמון וקצב מתוך פריימים נבחרים ומהקול (אם איכותו מספקת)." : "Timing and rhythm from sampled frames and audio (when quality allows)."}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="font-semibold flex items-center gap-1.5 mb-1"><Sparkles className="h-3.5 w-3.5" />{he ? "מה הוערך ע״י AI" : "What AI estimated"}</p>
            <p className="text-muted-foreground">{he ? "סוג הצעד, זוויות מפרקים ומגעי פרסה — הערכות, לא מדידה רציפה." : "Gait type, joint angles and hoof contacts — estimates, not continuous measurement."}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
