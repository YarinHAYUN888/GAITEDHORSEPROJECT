import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface PipelineEvent {
  stage: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function PipelineHealthDashboard() {
  const { t } = useLanguage();
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const days = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await (supabase as any)
        .from("pipeline_events")
        .select("stage, status, duration_ms, error_message, metadata, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!error && data) {
        setEvents(data as PipelineEvent[]);
      }
      setLoading(false);
    };
    fetchEvents();
  }, [timeRange]);

  const stats = useMemo(() => {
    const summaries = events.filter((e) => e.stage === "summary");
    const stageEvents = events.filter((e) => e.stage !== "summary");

    // Stage failure rates
    const stageMap: Record<string, { total: number; failed: number }> = {};
    for (const e of stageEvents) {
      if (!stageMap[e.stage]) stageMap[e.stage] = { total: 0, failed: 0 };
      stageMap[e.stage].total++;
      if (e.status === "failed") stageMap[e.stage].failed++;
    }

    const stageFailRates = Object.entries(stageMap).map(([stage, v]) => ({
      stage,
      failRate: v.total > 0 ? Math.round((v.failed / v.total) * 100) : 0,
      total: v.total,
    }));

    // Critic overrides
    const criticOverrides = summaries.filter((s) => (s.metadata as any)?.criticOverride === true).length;
    const unknowns = summaries.filter((s) => (s.metadata as any)?.classification === "unknown").length;

    return {
      totalAnalyses: summaries.length,
      criticOverridePct: summaries.length > 0 ? Math.round((criticOverrides / summaries.length) * 100) : 0,
      unknownPct: summaries.length > 0 ? Math.round((unknowns / summaries.length) * 100) : 0,
      stageFailRates,
      avgDurationMs: summaries.length > 0
        ? Math.round(summaries.reduce((sum, s) => sum + ((s.duration_ms ?? 0)), 0) / summaries.length)
        : 0,
    };
  }, [events]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartConfig = {
    failRate: { label: t("pipeline.failRate"), color: "hsl(var(--destructive))" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t("pipeline.healthTitle")}</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7d</SelectItem>
            <SelectItem value="30d">30d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{stats.totalAnalyses}</p>
            <p className="text-xs text-muted-foreground">{t("pipeline.totalAnalyses")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{stats.avgDurationMs > 0 ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : "—"}</p>
            <p className="text-xs text-muted-foreground">{t("pipeline.avgDuration")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center flex flex-col items-center">
            <p className="text-2xl font-bold">{stats.criticOverridePct}%</p>
            <Badge variant={stats.criticOverridePct > 20 ? "destructive" : "secondary"} className="text-xs mt-1">
              {t("pipeline.criticOverrides")}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center flex flex-col items-center">
            <p className="text-2xl font-bold">{stats.unknownPct}%</p>
            <Badge variant={stats.unknownPct > 15 ? "destructive" : "secondary"} className="text-xs mt-1">
              {t("pipeline.unknownClassifications")}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Stage Failure Rates Chart */}
      {stats.stageFailRates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("pipeline.stageFailRates")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={stats.stageFailRates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="failRate" fill="var(--color-failRate)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {stats.totalAnalyses === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {t("pipeline.noData")}
        </div>
      )}
    </div>
  );
}
