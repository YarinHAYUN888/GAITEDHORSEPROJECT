import { useState, useEffect } from "react";
import { BarChart3, Loader2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { callEdgeFunction } from "@/services/edgeFunctionClient";
import { toast } from "sonner";

interface BenchmarkData {
  percentiles: Record<string, number | null> | null;
  sampleSize: number;
  breedId?: string;
  averages?: { overallScore: number | null; symmetryScore: number | null };
  message?: string;
}

interface Props {
  analysisId: string;
  breedId?: string;
}

function PercentileBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const color = value >= 75 ? "text-green-500" : value >= 50 ? "text-yellow-500" : value >= 25 ? "text-orange-500" : "text-destructive";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${color}`}>פרסנטיל {value}</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

export default function BenchmarkCard({ analysisId, breedId }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BenchmarkData | null>(null);

  const fetchBenchmark = async () => {
    setLoading(true);
    try {
      const result = await callEdgeFunction<BenchmarkData>("cross-horse-benchmark", { analysisId, breedId });
      setData(result);
    } catch (e: any) {
      toast.error(e.message || "שגיאה בטעינת Benchmark");
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <Button onClick={fetchBenchmark} disabled={loading} variant="outline" size="sm" className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
        {loading ? "מחשב..." : "השוואה לסוסים אחרים"}
      </Button>
    );
  }

  if (data.message || !data.percentiles) {
    return (
      <Card className="border-muted">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          {data.message || "אין מספיק נתונים"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          השוואה לסוסים אחרים
          <Badge variant="outline" className="text-xs">
            {data.sampleSize} ניתוחים
            {data.breedId ? ` • ${data.breedId}` : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PercentileBar label="ציון כללי" value={data.percentiles.overallScore} />
        <PercentileBar label="סימטריה" value={data.percentiles.symmetryScore} />
        <PercentileBar label="ביטחון" value={data.percentiles.confidence} />
        <PercentileBar label="סנכרון לטרלי" value={data.percentiles.lateralSync} />

        {data.averages && (
          <div className="text-xs text-muted-foreground pt-1 border-t flex gap-4">
            {data.averages.overallScore != null && <span>ממוצע ציון: {data.averages.overallScore}</span>}
            {data.averages.symmetryScore != null && <span>ממוצע סימטריה: {data.averages.symmetryScore}</span>}
          </div>
        )}

        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={fetchBenchmark} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          רענן
        </Button>
      </CardContent>
    </Card>
  );
}
