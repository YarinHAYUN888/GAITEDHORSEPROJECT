import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from "recharts";
import { Users, TrendingUp } from "lucide-react";

interface HorseGaitSummary {
  id: string;
  name: string;
  avgScore: number;
  avgSymmetry: number;
  analysisCount: number;
  bestGait: string | null;
  color: string;
}

const COLORS = [
  "hsl(38, 92%, 50%)",
  "hsl(200, 80%, 60%)",
  "hsl(140, 60%, 50%)",
  "hsl(280, 60%, 60%)",
  "hsl(350, 70%, 55%)",
  "hsl(50, 80%, 55%)",
];

export default function MultiHorseComparison() {
  const { t, dir } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: horses = [] } = useQuery({
    queryKey: ["comparison-horses"],
    queryFn: async () => {
      const { data } = await supabase.from("horses").select("id, name").order("name");
      return (data || []) as { id: string; name: string }[];
    },
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ["comparison-analyses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gait_analyses")
        .select("horse_id, overall_score, symmetry_score, gait_type")
        .not("horse_id", "is", null);
      return data || [];
    },
  });

  const horseSummaries = useMemo<HorseGaitSummary[]>(() => {
    return horses
      .filter((h) => selectedIds.includes(h.id))
      .map((h, i) => {
        const hAnalyses = analyses.filter((a) => a.horse_id === h.id);
        const scores = hAnalyses.map((a) => a.overall_score).filter(Boolean) as number[];
        const syms = hAnalyses.map((a) => a.symmetry_score).filter(Boolean) as number[];
        const gaits = hAnalyses.map((a) => a.gait_type).filter(Boolean);
        const gaitCounts: Record<string, number> = {};
        gaits.forEach((g) => { gaitCounts[g!] = (gaitCounts[g!] || 0) + 1; });
        const bestGait = Object.entries(gaitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        return {
          id: h.id,
          name: h.name,
          avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
          avgSymmetry: syms.length ? Math.round(syms.reduce((a, b) => a + b, 0) / syms.length) : 0,
          analysisCount: hAnalyses.length,
          bestGait,
          color: COLORS[i % COLORS.length],
        };
      });
  }, [horses, analyses, selectedIds]);

  const toggleHorse = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 6 ? [...prev, id] : prev
    );
  };

  const barData = horseSummaries.map((h) => ({
    name: h.name,
    GES: h.avgScore,
    SI: h.avgSymmetry,
  }));

  const radarData = [
    { metric: "GES", ...Object.fromEntries(horseSummaries.map((h) => [h.name, h.avgScore])) },
    { metric: "SI", ...Object.fromEntries(horseSummaries.map((h) => [h.name, h.avgSymmetry])) },
    { metric: t("comparison.analyses"), ...Object.fromEntries(horseSummaries.map((h) => [h.name, Math.min(h.analysisCount * 10, 100)])) },
  ];

  return (
    <div className="container py-8 space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-rubik font-bold text-gradient-gold flex items-center gap-2">
          <Users className="h-7 w-7" />
          {t("comparison.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("comparison.subtitle")}</p>
      </div>

      {/* Horse selector */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-rubik">{t("comparison.selectHorses")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {horses.map((h) => (
              <label key={h.id} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={selectedIds.includes(h.id)}
                  onCheckedChange={() => toggleHorse(h.id)}
                />
                <span className="text-sm">{h.name}</span>
              </label>
            ))}
          </div>
          {selectedIds.length >= 6 && (
            <p className="text-xs text-muted-foreground mt-2">{t("comparison.maxReached")}</p>
          )}
        </CardContent>
      </Card>

      {horseSummaries.length >= 2 && (
        <>
          {/* Bar chart */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-rubik flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t("comparison.scoreComparison")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="GES" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="GES" />
                  <Bar dataKey="SI" fill="hsl(200, 80%, 60%)" radius={[4, 4, 0, 0]} name="SI" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {horseSummaries.map((h) => (
              <Card key={h.id} className="glass-card" style={{ borderTopColor: h.color, borderTopWidth: 3 }}>
                <CardContent className="pt-5 space-y-2">
                  <h3 className="font-rubik font-bold text-lg">{h.name}</h3>
                  <div className="flex gap-3">
                    <Badge variant="secondary">GES: {h.avgScore}</Badge>
                    <Badge variant="outline">SI: {h.avgSymmetry}</Badge>
                  </div>
                  <Separator />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{t("comparison.analyses")}: {h.analysisCount}</p>
                    {h.bestGait && <p>{t("comparison.bestGait")}: {h.bestGait}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {horseSummaries.length < 2 && selectedIds.length > 0 && (
        <p className="text-center text-muted-foreground py-8">{t("comparison.selectMore")}</p>
      )}
    </div>
  );
}
