// Pipeline Monitoring Alerts — detects failure rate spikes and latency anomalies

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Activity, Clock, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AlertRule {
  id: string;
  name: string;
  nameHe: string;
  check: (events: PipelineEvent[]) => AlertResult | null;
}

interface AlertResult {
  severity: "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
}

interface PipelineEvent {
  stage: string;
  status: string;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ALERT_RULES: AlertRule[] = [
  {
    id: "high-failure-rate",
    name: "High Failure Rate",
    nameHe: "שיעור כשלונות גבוה",
    check: (events) => {
      const summaries = events.filter(e => e.stage === "summary");
      if (summaries.length < 5) return null;
      const failed = summaries.filter(e => e.status === "partial").length;
      const rate = failed / summaries.length;
      if (rate > 0.3) return { severity: "critical", message: `${(rate * 100).toFixed(0)}% of analyses have failures`, value: rate, threshold: 0.3 };
      if (rate > 0.15) return { severity: "warning", message: `${(rate * 100).toFixed(0)}% of analyses have failures`, value: rate, threshold: 0.15 };
      return null;
    },
  },
  {
    id: "high-latency",
    name: "High Latency",
    nameHe: "זמני תגובה גבוהים",
    check: (events) => {
      const summaries = events.filter(e => e.stage === "summary" && e.duration_ms != null);
      if (summaries.length < 3) return null;
      const avgMs = summaries.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0) / summaries.length;
      if (avgMs > 120_000) return { severity: "critical", message: `Average latency: ${(avgMs / 1000).toFixed(0)}s`, value: avgMs, threshold: 120_000 };
      if (avgMs > 60_000) return { severity: "warning", message: `Average latency: ${(avgMs / 1000).toFixed(0)}s`, value: avgMs, threshold: 60_000 };
      return null;
    },
  },
  {
    id: "critic-override-spike",
    name: "Critic Override Spike",
    nameHe: "עליה בדריסות Critic",
    check: (events) => {
      const summaries = events.filter(e => e.stage === "summary");
      if (summaries.length < 5) return null;
      const overrides = summaries.filter(e => (e.metadata as any)?.criticOverride === true).length;
      const rate = overrides / summaries.length;
      if (rate > 0.4) return { severity: "critical", message: `${(rate * 100).toFixed(0)}% critic overrides`, value: rate, threshold: 0.4 };
      if (rate > 0.2) return { severity: "warning", message: `${(rate * 100).toFixed(0)}% critic overrides`, value: rate, threshold: 0.2 };
      return null;
    },
  },
  {
    id: "stage-failure-concentration",
    name: "Stage Failure Concentration",
    nameHe: "ריכוז כשלונות בשלב מסוים",
    check: (events) => {
      const nonSummary = events.filter(e => e.stage !== "summary" && e.stage !== "done");
      if (nonSummary.length < 10) return null;
      const stageFailures: Record<string, number> = {};
      const stageTotals: Record<string, number> = {};
      for (const e of nonSummary) {
        stageTotals[e.stage] = (stageTotals[e.stage] ?? 0) + 1;
        if (e.status === "failed") stageFailures[e.stage] = (stageFailures[e.stage] ?? 0) + 1;
      }
      for (const [stage, fails] of Object.entries(stageFailures)) {
        const total = stageTotals[stage] ?? 1;
        const rate = fails / total;
        if (rate > 0.5 && total >= 3) {
          return { severity: "critical", message: `Stage "${stage}": ${(rate * 100).toFixed(0)}% failure rate`, value: rate, threshold: 0.5 };
        }
      }
      return null;
    },
  },
];

export default function PipelineMonitoringAlerts() {
  const { lang } = useLanguage();
  const isHe = lang === "he";
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("pipeline_events")
      .select("stage, status, duration_ms, metadata, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (!error && data) setEvents(data as unknown as PipelineEvent[]);
        setLoading(false);
      });
  }, []);

  const alerts = useMemo(() => {
    return ALERT_RULES.map(rule => ({
      rule,
      result: rule.check(events),
    })).filter(a => a.result !== null) as Array<{ rule: AlertRule; result: AlertResult }>;
  }, [events]);

  if (loading) return null;

  if (alerts.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Activity className="h-5 w-5 text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-400">
            {isHe ? "כל המערכות תקינות — אין התראות פעילות" : "All systems healthy — no active alerts"}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {isHe ? "התראות מערכת" : "System Alerts"}
          <Badge variant="destructive" className="text-[10px]">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map(({ rule, result }) => (
          <div
            key={rule.id}
            className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
              result.severity === "critical"
                ? "border-destructive/50 bg-destructive/5"
                : "border-yellow-500/50 bg-yellow-500/5"
            }`}
          >
            {result.severity === "critical" ? (
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            ) : (
              <Clock className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            )}
            <div>
              <div className="font-medium text-foreground">{isHe ? rule.nameHe : rule.name}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{result.message}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {(result.value * (result.threshold < 1 ? 100 : 1)).toFixed(0)}
                  {result.threshold < 1 ? "%" : "ms"}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {isHe ? "סף" : "threshold"}: {(result.threshold * (result.threshold < 1 ? 100 : 1)).toFixed(0)}
                  {result.threshold < 1 ? "%" : "ms"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
