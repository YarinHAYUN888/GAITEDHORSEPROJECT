import { useState, useCallback } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkAllIntegrations, type AllIntegrationsResult, type IntegrationCheck } from "@/lib/integrationHealth";
import { getVersion, getAllModels } from "@/lib/modelVersioning";

const statusConfig = {
  ok: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "תקין" },
  degraded: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "מוגבל" },
  down: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "מושבת" },
  unknown: { icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted", label: "לא ידוע" },
};

function StatusBadge({ status }: { status: IntegrationCheck["status"] }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.bg} ${config.color} border-0 gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function IntegrationStatus() {
  const [result, setResult] = useState<AllIntegrationsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = useCallback(async () => {
    setLoading(true);
    try {
      const r = await checkAllIntegrations();
      setResult(r);
    } catch {
      setResult({ overall: "down", checks: [], timestamp: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, []);

  const overallConfig = result ? statusConfig[result.overall === "healthy" ? "ok" : result.overall] : null;

  return (
    <Card dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">סטטוס אינטגרציות</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">v{getVersion()}</span>
          <Button variant="ghost" size="sm" onClick={runCheck} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="mr-1 text-xs">בדוק עכשיו</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">לחצו &quot;בדוק עכשיו&quot; לבדיקת סטטוס</p>
        )}

        {result && (
          <>
            <div className={`flex items-center gap-2 p-2 rounded-md ${overallConfig?.bg}`}>
              {overallConfig && <overallConfig.icon className={`h-5 w-5 ${overallConfig.color}`} />}
              <span className={`text-sm font-medium ${overallConfig?.color}`}>
                מצב כללי: {overallConfig?.label}
              </span>
            </div>

            <div className="space-y-2">
              {result.checks.map((check) => (
                <div key={check.name} className="flex items-center justify-between p-2 rounded border border-border">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={check.status} />
                    <span className="text-sm font-medium">{check.nameHe}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{check.latencyMs}ms</span>
                    {check.details && (
                      <span className="text-xs text-destructive max-w-[150px] truncate">{check.details}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-left">
              נבדק: {new Date(result.timestamp).toLocaleTimeString("he-IL")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
