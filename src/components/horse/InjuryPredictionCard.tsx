import { useState } from "react";
import { AlertTriangle, Shield, TrendingDown, TrendingUp, Minus, Loader2, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { callEdgeFunction } from "@/services/edgeFunctionClient";
import { toast } from "sonner";

interface Concern {
  area: string;
  concern: string;
  trend: "improving" | "stable" | "worsening";
  urgency: "monitor" | "attention" | "urgent";
}

interface Prediction {
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  concerns: Concern[];
  recommendations: string[];
  summary: string;
  dataQuality: string;
}

interface Props {
  horseId: string;
}

const riskColors: Record<string, string> = {
  low: "bg-green-500",
  moderate: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-destructive",
};

const riskLabels: Record<string, string> = {
  low: "סיכון נמוך",
  moderate: "סיכון בינוני",
  high: "סיכון גבוה",
  critical: "סיכון קריטי",
};

const trendIcons = {
  improving: <TrendingUp className="h-3 w-3 text-green-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  worsening: <TrendingDown className="h-3 w-3 text-destructive" />,
};

const urgencyBadge: Record<string, "outline" | "secondary" | "destructive"> = {
  monitor: "outline",
  attention: "secondary",
  urgent: "destructive",
};

export default function InjuryPredictionCard({ horseId }: Props) {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const predict = async () => {
    setLoading(true);
    try {
      const data = await callEdgeFunction<{ prediction: Prediction | null; analysisCount?: number; message?: string }>(
        "injury-prediction", { horseId }
      );
      setPrediction(data.prediction);
      setAnalysisCount(data.analysisCount || 0);
      setMessage(data.message || null);
    } catch (e: any) {
      toast.error(e.message || "שגיאה בחיזוי");
    } finally {
      setLoading(false);
    }
  };

  if (!prediction && !message) {
    return (
      <Button onClick={predict} disabled={loading} variant="outline" size="sm" className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
        {loading ? "מנתח מגמות..." : "חיזוי פציעות"}
      </Button>
    );
  }

  if (message && !prediction) {
    return (
      <Card className="border-muted">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          {message}
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  return (
    <Card className={`border ${prediction.riskLevel === "low" ? "border-green-500/30" : prediction.riskLevel === "critical" ? "border-destructive/50" : "border-orange-500/30"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          חיזוי פציעות
          <Badge className={`text-xs text-white ${riskColors[prediction.riskLevel]}`}>
            {riskLabels[prediction.riskLevel]} ({prediction.riskScore}/100)
          </Badge>
          <Badge variant="outline" className="text-xs ms-auto">
            {analysisCount} ניתוחים • איכות: {prediction.dataQuality}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <p className="text-sm" dir="rtl">{prediction.summary}</p>

        {/* Concerns */}
        {prediction.concerns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">חששות:</h4>
            {prediction.concerns.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-muted/50 p-2 rounded">
                {trendIcons[c.trend]}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.area}</span>
                    <Badge variant={urgencyBadge[c.urgency]} className="text-[10px]">
                      {c.urgency === "monitor" ? "מעקב" : c.urgency === "attention" ? "תשומת לב" : "דחוף"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{c.concern}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {prediction.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">המלצות:</h4>
            <ul className="text-xs space-y-1">
              {prediction.recommendations.map((r, i) => (
                <li key={i} className="text-muted-foreground">• {r}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/60 pt-1 border-t">
          ⚠️ חיזוי AI בלבד — אינו מחליף בדיקה וטרינרית מקצועית
        </p>

        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={predict} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          חזה מחדש
        </Button>
      </CardContent>
    </Card>
  );
}
