import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, CheckCircle, AlertTriangle, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface HorseOption {
  id: string;
  name: string;
}

interface AnalysisRow {
  id: string;
  created_at: string;
  overall_score: number | null;
  lateral_sync_pct: number | null;
  symmetry_score: number | null;
  gait_type: string | null;
  gait_type_hebrew: string | null;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
  return (stdDev / mean) * 100;
}

export default function GaitValidator() {
  const [horses, setHorses] = useState<HorseOption[]>([]);
  const [selectedHorse, setSelectedHorse] = useState("");
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reliability, setReliability] = useState<{ index: number; label: string; color: string } | null>(null);
  const { t, lang } = useLanguage();

  useEffect(() => {
    supabase.from("horses").select("id, name").then(({ data }) => {
      if (data) setHorses(data);
    });
  }, []);

  const loadAnalyses = async (horseId: string) => {
    setSelectedHorse(horseId);
    setLoading(true);
    setReliability(null);

    const { data, error } = await supabase
      .from("gait_analyses")
      .select("id, created_at, overall_score, lateral_sync_pct, symmetry_score, gait_type, gait_type_hebrew")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      toast.error(t("gval.loadError"));
      return;
    }
    setAnalyses(data || []);

    // Calculate reliability if 3+ analyses
    if (data && data.length >= 3) {
      const scores = data.map((a) => a.overall_score).filter((v): v is number => v !== null);
      const syncs = data.map((a) => a.lateral_sync_pct).filter((v): v is number => v !== null);
      const syms = data.map((a) => a.symmetry_score).filter((v): v is number => v !== null);

      const cvs = [
        scores.length >= 3 ? coefficientOfVariation(scores) : null,
        syncs.length >= 3 ? coefficientOfVariation(syncs) : null,
        syms.length >= 3 ? coefficientOfVariation(syms) : null,
      ].filter((v): v is number => v !== null);

      if (cvs.length > 0) {
        const avgCV = cvs.reduce((a, b) => a + b, 0) / cvs.length;
        const reliabilityIndex = Math.max(0, Math.min(100, Math.round(100 - avgCV * 5)));

        let label: string;
        let color: string;
        if (avgCV < 10) {
          label = t("gval.highReliability");
          color = "text-green-500";
        } else if (avgCV < 20) {
          label = t("gval.medReliability");
          color = "text-yellow-500";
        } else {
          label = t("gval.lowReliability");
          color = "text-destructive";
        }

        setReliability({ index: reliabilityIndex, label, color });
      }
    }
  };

  const horseName = horses.find((h) => h.id === selectedHorse)?.name;

  return (
    <div className="py-12">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-rubik font-bold mb-3">{t("gval.title")}</h1>
          <p className="text-muted-foreground">{t("gval.subtitle")}</p>
        </motion.div>

        <Card className="glass-card mb-6">
          <CardContent className="pt-6 space-y-4">
            <Select value={selectedHorse} onValueChange={loadAnalyses}>
              <SelectTrigger>
                <SelectValue placeholder={t("gval.selectHorse")} />
              </SelectTrigger>
              <SelectContent>
                {horses.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {loading && (
              <div className="flex items-center gap-2 justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t("gval.loading")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reliability Index */}
        {reliability && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className={`glass-card mb-6 ${reliability.index >= 80 ? "border-green-500/30" : reliability.index >= 50 ? "border-yellow-500/30" : "border-destructive/30"}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {t("gval.reliability").replace("{name}", horseName || "")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${reliability.color}`}>{reliability.index}</div>
                  <div className="flex-1">
                    <Progress value={reliability.index} className="h-3" />
                    <p className={`text-sm mt-1 font-medium ${reliability.color}`}>{reliability.label}</p>
                  </div>
                </div>
                {reliability.index >= 80 && (
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 ml-1" /> {t("gval.qualitySeal")}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Analyses List */}
        {analyses.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">{t("gval.analysesFound").replace("{count}", String(analyses.length))}</h3>
            {analyses.map((a) => (
              <Card key={a.id} className="glass-card">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {(lang === "he" ? a.gait_type_hebrew : a.gait_type) || a.gait_type || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString(lang === "he" ? "he-IL" : "en-US")}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {a.overall_score !== null && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.overall_score}</p>
                        <p className="text-xs text-muted-foreground">{t("gval.score")}</p>
                      </div>
                    )}
                    {a.symmetry_score !== null && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.symmetry_score}</p>
                        <p className="text-xs text-muted-foreground">{t("gval.symmetry")}</p>
                      </div>
                    )}
                    {a.lateral_sync_pct !== null && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.lateral_sync_pct}%</p>
                        <p className="text-xs text-muted-foreground">{t("gval.sync")}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedHorse && !loading && analyses.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{t("gval.noAnalyses")}</p>
        )}

        {selectedHorse && analyses.length > 0 && analyses.length < 3 && (
          <div className="flex items-center gap-2 bg-yellow-500/10 rounded-lg p-4 mt-4">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <p className="text-sm text-yellow-500">{t("gval.needMore")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
