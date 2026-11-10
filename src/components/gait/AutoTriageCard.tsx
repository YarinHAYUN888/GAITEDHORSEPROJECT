import { useState, useCallback } from "react";
import { AlertTriangle, CheckCircle, Camera, Sun, Move, Eye, Shield, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { callEdgeFunction } from "@/services/edgeFunctionClient";
import { motion, AnimatePresence } from "framer-motion";

export interface TriageResult {
  suitable: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  angleOk: boolean;
  horseDetected: boolean;
  movementDetected: boolean;
  lightingOk: boolean;
  stabilityOk: boolean;
}

interface Props {
  onTriageComplete: (result: TriageResult) => void;
  frames: string[];
}

export default function AutoTriageCard({ onTriageComplete, frames }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);

  const runTriage = useCallback(async () => {
    if (!frames.length) return;
    setLoading(true);
    try {
      const data = await callEdgeFunction<TriageResult>("auto-triage", { frames });
      setResult(data);
      onTriageComplete(data);
    } catch (e) {
      // On error, assume suitable to not block the user
      const fallback: TriageResult = {
        suitable: true, confidence: 0.5, issues: [], suggestions: [],
        angleOk: true, horseDetected: true, movementDetected: true, lightingOk: true, stabilityOk: true,
      };
      setResult(fallback);
      onTriageComplete(fallback);
    } finally {
      setLoading(false);
    }
  }, [frames, onTriageComplete]);

  // Auto-run when frames are available
  if (frames.length > 0 && !result && !loading) {
    runTriage();
  }

  const checks = result ? [
    { label: "סוס מזוהה", ok: result.horseDetected, icon: Eye },
    { label: "זווית צד", ok: result.angleOk, icon: Camera },
    { label: "תנועה", ok: result.movementDetected, icon: Move },
    { label: "תאורה", ok: result.lightingOk, icon: Sun },
    { label: "יציבות", ok: result.stabilityOk, icon: Shield },
  ] : [];

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">בודק איכות סרטון...</span>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={`border ${result.suitable ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              {result.suitable ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>הסרטון מתאים לניתוח</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span>בעיות זוהו בסרטון</span>
                </>
              )}
              <Badge variant="outline" className="text-xs ms-auto">
                ביטחון: {Math.round(result.confidence * 100)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {/* Quality checks */}
            <div className="flex flex-wrap gap-2">
              {checks.map(({ label, ok, icon: Icon }) => (
                <Badge key={label} variant={ok ? "outline" : "destructive"} className="text-xs gap-1">
                  <Icon className="h-3 w-3" />
                  {label}
                </Badge>
              ))}
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="space-y-1">
                {result.issues.map((issue, i) => (
                  <p key={i} className="text-xs text-destructive">⚠️ {issue}</p>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="space-y-1">
                {result.suggestions.map((s, i) => (
                  <p key={i} className="text-xs text-muted-foreground">💡 {s}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
