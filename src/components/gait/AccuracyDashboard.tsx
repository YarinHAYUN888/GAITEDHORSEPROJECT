import { useState, useEffect, useMemo } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

interface ValidationRow {
  analysis_id: string;
  labeled_gait_type: string;
  vote_count: number;
  avg_confidence: number;
  validator_count: number;
}

interface AnalysisRow {
  id: string;
  gait_type: string | null;
  confidence: number | null;
}

export default function AccuracyDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validations, setValidations] = useState<ValidationRow[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as const }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      (supabase.from("gait_validations" as any) as any).select("analysis_id, labeled_gait_type, confidence, validator_id"),
      supabase.from("gait_analyses").select("id, gait_type, confidence"),
    ]).then(([vRes, aRes]) => {
      // Aggregate validations client-side
      const rawValidations = (vRes.data || []) as Array<{ analysis_id: string; labeled_gait_type: string; confidence: number; validator_id: string }>;
      const grouped = new Map<string, Map<string, { count: number; totalConf: number; validators: Set<string> }>>();
      for (const v of rawValidations) {
        if (!grouped.has(v.analysis_id)) grouped.set(v.analysis_id, new Map());
        const gaitMap = grouped.get(v.analysis_id)!;
        const entry = gaitMap.get(v.labeled_gait_type) || { count: 0, totalConf: 0, validators: new Set<string>() };
        entry.count++;
        entry.totalConf += v.confidence || 3;
        entry.validators.add(v.validator_id);
        gaitMap.set(v.labeled_gait_type, entry);
      }
      const aggregated: ValidationRow[] = [];
      for (const [aid, gaitMap] of grouped) {
        for (const [gt, entry] of gaitMap) {
          aggregated.push({ analysis_id: aid, labeled_gait_type: gt, vote_count: entry.count, avg_confidence: entry.totalConf / entry.count, validator_count: entry.validators.size });
        }
      }
      setValidations(aggregated);
      setAnalyses((aRes.data || []) as AnalysisRow[]);
      setLoading(false);
    });
  }, [isAdmin]);

  const stats = useMemo(() => {
    // Build consensus map: analysis_id → winning gait_type
    const consensusMap = new Map<string, string>();
    const voteMap = new Map<string, Map<string, number>>();
    for (const v of validations) {
      if (!voteMap.has(v.analysis_id)) voteMap.set(v.analysis_id, new Map());
      voteMap.get(v.analysis_id)!.set(v.labeled_gait_type, v.vote_count);
    }
    for (const [aid, votes] of voteMap) {
      let best = ""; let bestCount = 0;
      for (const [gt, count] of votes) {
        if (count > bestCount) { best = gt; bestCount = count; }
      }
      if (bestCount >= 2) consensusMap.set(aid, best);
    }

    // Compare system vs consensus
    let correct = 0; let total = 0; let uncertain = 0;
    const confMatrix: Record<string, Record<string, number>> = {};
    const gaitTypes = new Set<string>();

    for (const a of analyses) {
      const consensus = consensusMap.get(a.id);
      if (!consensus) continue;
      total++;
      const sys = a.gait_type || "unknown";
      gaitTypes.add(sys);
      gaitTypes.add(consensus);

      if (!confMatrix[sys]) confMatrix[sys] = {};
      confMatrix[sys][consensus] = (confMatrix[sys][consensus] || 0) + 1;

      if (sys === consensus) correct++;
      if (a.confidence !== null && a.confidence < 60) uncertain++;
    }

    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const uncertainPct = total > 0 ? Math.round((uncertain / total) * 100) : 0;

    // Per-gait accuracy
    const perGait: Array<{ gait: string; accuracy: number; total: number }> = [];
    for (const gt of gaitTypes) {
      let gtCorrect = 0; let gtTotal = 0;
      for (const a of analyses) {
        if (a.gait_type !== gt) continue;
        const c = consensusMap.get(a.id);
        if (!c) continue;
        gtTotal++;
        if (c === gt) gtCorrect++;
      }
      if (gtTotal > 0) perGait.push({ gait: gt, accuracy: Math.round((gtCorrect / gtTotal) * 100), total: gtTotal });
    }

    return { accuracy, total, uncertain: uncertainPct, perGait, confMatrix, gaitTypes: Array.from(gaitTypes), consensusCount: consensusMap.size };
  }, [validations, analyses]);

  if (!isAdmin) return null;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const chartConfig: Record<string, { label: string; color: string }> = {};
  stats.perGait.forEach((g, i) => {
    chartConfig[g.gait] = { label: g.gait, color: `hsl(${(i * 60) % 360}, 70%, 50%)` };
  });
  chartConfig.accuracy = { label: t("acc.accuracy"), color: "hsl(var(--primary))" };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-rubik font-bold flex items-center justify-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          {t("acc.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("acc.subtitle")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card text-center">
          <CardContent className="pt-4">
            <p className="text-3xl font-bold text-primary">{stats.accuracy}%</p>
            <p className="text-xs text-muted-foreground">{t("acc.overallAccuracy")}</p>
          </CardContent>
        </Card>
        <Card className="glass-card text-center">
          <CardContent className="pt-4">
            <p className="text-3xl font-bold">{stats.consensusCount}</p>
            <p className="text-xs text-muted-foreground">{t("acc.validated")}</p>
          </CardContent>
        </Card>
        <Card className="glass-card text-center">
          <CardContent className="pt-4">
            <p className="text-3xl font-bold text-yellow-500">{stats.uncertain}%</p>
            <p className="text-xs text-muted-foreground">{t("acc.uncertain")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-gait accuracy chart */}
      {stats.perGait.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("acc.perGait")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={stats.perGait}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="gait" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                  {stats.perGait.map((_, i) => (
                    <Cell key={i} fill={`hsl(${(i * 60) % 360}, 70%, 50%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Confusion matrix */}
      {stats.gaitTypes.length > 0 && stats.total > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("acc.confusionMatrix")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="p-1 text-start text-muted-foreground">System ↓ / Human →</th>
                  {stats.gaitTypes.map((gt) => <th key={gt} className="p-1 text-center">{gt}</th>)}
                </tr>
              </thead>
              <tbody>
                {stats.gaitTypes.map((sysGt) => (
                  <tr key={sysGt}>
                    <td className="p-1 font-medium">{sysGt}</td>
                    {stats.gaitTypes.map((humanGt) => {
                      const count = stats.confMatrix[sysGt]?.[humanGt] || 0;
                      const isCorrect = sysGt === humanGt;
                      return (
                        <td key={humanGt} className={`p-1 text-center ${isCorrect && count > 0 ? "text-green-500 font-bold" : count > 0 ? "text-destructive" : "text-muted-foreground/30"}`}>
                          {count || "·"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {stats.total === 0 && (
        <Card className="glass-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>{t("acc.noData")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
