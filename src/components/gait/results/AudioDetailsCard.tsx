import { Volume2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AudioAnalysis } from "@/types/gait";
import { useLanguage } from "@/contexts/LanguageContext";

interface AudioDetailsCardProps {
  audioAnalysis?: AudioAnalysis;
  analysisMode: "vision" | "audio" | "both";
}

export default function AudioDetailsCard({ audioAnalysis, analysisMode }: AudioDetailsCardProps) {
  const { t } = useLanguage();
  if (!audioAnalysis || analysisMode === "vision") return null;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Volume2 className="h-4 w-4 text-primary" />{t("audio.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div><p className="text-xs text-muted-foreground">{t("audio.bpm")}</p><p className="text-2xl font-bold text-foreground">{audioAnalysis.detectedBPM}</p></div>
          <div>
            <p className="text-xs text-muted-foreground">{t("audio.rhythmRegularity")}</p>
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-bold text-foreground">{audioAnalysis.rhythmRegularity}%</p>
              <Progress value={audioAnalysis.rhythmRegularity} className="h-2 w-20" />
            </div>
          </div>
          <div><p className="text-xs text-muted-foreground">{t("audio.beatPattern")}</p><Badge variant="outline" className="mt-1">{audioAnalysis.beatPattern}</Badge></div>
          <div><p className="text-xs text-muted-foreground">{t("audio.classification")}</p><Badge className="mt-1">{audioAnalysis.audioGaitClassification}</Badge></div>
        </div>
        {audioAnalysis.weakBeatDetected && (
          <div className="flex items-center gap-2 bg-destructive/10 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">{audioAnalysis.weakBeatDescription || t("audio.weakBeat")}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("audio.audioConfidence")}: {audioAnalysis.audioConfidence}%</p>
      </CardContent>
    </Card>
  );
}
