import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Play, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/services/edgeFunctionClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface TestRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  config: Record<string, unknown>;
  summary: Record<string, unknown>;
}

interface TestResult {
  id: string;
  scenario: string;
  status_code: number;
  latency_ms: number;
  success: boolean;
  credit_charged: boolean;
  truncated: boolean;
  error_message: string | null;
  correlation_id: string | null;
  metadata: Record<string, unknown>;
}

export default function SelfTestDashboard() {
  const { lang } = useLanguage();
  const isHe = lang === "he";
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchRuns();
  }, []);

  async function fetchRuns() {
    setLoading(true);
    const { data } = await supabase
      .from("load_test_runs" as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    setRuns((data as any[]) || []);
    setLoading(false);
  }

  async function fetchResults(runId: string) {
    setSelectedRun(runId);
    const { data } = await supabase
      .from("load_test_results" as any)
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });
    setResults((data as any[]) || []);
  }

  async function handleRunTest() {
    setRunning(true);
    try {
      const res = await callEdgeFunction<{ runId: string; summary: Record<string, unknown> }>(
        "load-test-runner",
        { scenarios: 12, concurrency: 5 }
      );
      toast.success(isHe ? "Self-Test הסתיים בהצלחה" : "Self-Test completed");
      await fetchRuns();
      if (res.runId) fetchResults(res.runId);
    } catch (err: any) {
      toast.error(err.message || "Self-Test failed");
    } finally {
      setRunning(false);
    }
  }

  const summary = selectedRun ? runs.find((r) => r.id === selectedRun)?.summary : null;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {isHe ? "Self-Test מקצה-לקצה" : "End-to-End Self-Test"}
          </CardTitle>
          <CardDescription>
            {isHe
              ? "הרצת 12 תרחישים סינתטיים מול gait-analysis כולל chaos"
              : "Runs 12 synthetic scenarios against gait-analysis including chaos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRunTest} disabled={running} className="gap-2">
            {running ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? (isHe ? "מריץ..." : "Running...") : (isHe ? "הרץ Self-Test" : "Run Self-Test")}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-primary">{String(summary.successCount ?? 0)}/{String(summary.totalScenarios ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{isHe ? "הצלחות" : "Passed"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{String(summary.latencyP50 ?? 0)}ms</div>
              <div className="text-xs text-muted-foreground">P50</div>
              <div className="text-xs text-muted-foreground">P95: {String(summary.latencyP95 ?? 0)}ms</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">
                {((Number(summary.errorRate ?? 0)) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">{isHe ? "שגיאות" : "Error Rate"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">
                {((Number(summary.expectationAccuracy ?? 0)) * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">{isHe ? "התאמת ציפיות" : "Expectation Match"}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isHe ? "ריצות אחרונות" : "Recent Runs"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Activity className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">{isHe ? "אין ריצות עדיין" : "No runs yet"}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isHe ? "תאריך" : "Date"}</TableHead>
                  <TableHead>{isHe ? "סטטוס" : "Status"}</TableHead>
                  <TableHead>{isHe ? "תרחישים" : "Scenarios"}</TableHead>
                  <TableHead>P95</TableHead>
                  <TableHead>{isHe ? "שגיאות" : "Errors"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id} className={selectedRun === run.id ? "bg-muted/50" : ""}>
                    <TableCell className="text-xs">
                      {new Date(run.started_at).toLocaleString(isHe ? "he-IL" : "en-US")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={run.status === "completed" ? "default" : run.status === "running" ? "secondary" : "destructive"}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{String(run.summary?.totalScenarios ?? "-")}</TableCell>
                    <TableCell>{run.summary?.latencyP95 ? `${run.summary.latencyP95}ms` : "-"}</TableCell>
                    <TableCell>{String(run.summary?.failCount ?? "-")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => fetchResults(run.id)}>
                        {isHe ? "פרטים" : "Details"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scenario Results */}
      {selectedRun && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isHe ? "תוצאות תרחישים" : "Scenario Results"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isHe ? "תרחיש" : "Scenario"}</TableHead>
                  <TableHead>{isHe ? "סטטוס" : "Status"}</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>{isHe ? "קרדיט" : "Credit"}</TableHead>
                  <TableHead>{isHe ? "שגיאה" : "Error"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const matched = (r.metadata as any)?.matchedExpectation;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.scenario}</TableCell>
                      <TableCell>
                        {r.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        {!matched && <AlertTriangle className="h-3 w-3 text-yellow-500 inline ml-1" />}
                      </TableCell>
                      <TableCell className="text-xs">{r.latency_ms}ms</TableCell>
                      <TableCell>
                        {r.credit_charged ? (
                          <Badge variant="secondary" className="text-xs">charged</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {r.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
