import { Shield, AlertTriangle, Mic, Activity, Info, Eye, Volume2, Layers, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GaitAnalysisResult } from "@/types/gait";
import type { CaptureQuality } from "@/components/GuidedCapture";
import type { DecisionOutcome, ReasonCode } from "@/types/pipeline";

const ANALYSIS_MODE_ICONS: Record<string, typeof Eye> = {
  vision: Eye,
  audio: Volume2,
  both: Layers,
};

const RECAPTURE_TIPS: Record<ReasonCode, string> = {
  Q_LOW_BLUR: "recapture.blur",
  Q_LOW_SHAKE: "recapture.shake",
  Q_OUT_OF_FRAME: "recapture.frame",
  Q_NOT_SIDE_VIEW: "recapture.sideView",
  W_TOO_FEW_CONTACTS: "recapture.contacts",
  W_LOW_CONTACT_CONF: "recapture.contacts",
  W_HIGH_OCCLUSION: "recapture.occlusion",
  W_IRREGULAR_ORDER: "recapture.order",
  D_LOW_CONFIDENCE: "recapture.general",
  D_ALTERNATIVES_CLOSE: "recapture.general",
  D_CONFLICT_WINDOWS: "recapture.general",
  D_RECAPTURE_NEEDED: "recapture.general",
  C_CONTRADICT_EVENNESS: "recapture.general",
  C_LAG_STD_HIGH: "recapture.general",
  C_VARIABILITY_HIGH: "recapture.general",
};

function ScoreCircle({ score, label, tooltip }: { score: number | null; label: string; tooltip?: string }) {
  const color = score === null ? "text-muted-foreground" : score >= 80 ? "text-primary" : score >= 60 ? "text-primary" : score >= 40 ? "text-destructive" : "text-destructive";
  const { t } = useLanguage();
  const qualityText = score === null ? "—" : score >= 80 ? t("score.qualityNormal") : score >= 60 ? t("score.qualityFair") : score >= 40 ? t("score.qualityLow") : t("score.qualityAbnormal");

  const circle = (
    <div className="flex flex-col items-center gap-2" aria-label={`${label}: ${score} — ${qualityText}`} role="img">
      <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-muted flex items-center justify-center">
        <span className={`text-xl md:text-2xl font-bold ${color}`}>{score ?? "—"}</span>
      </div>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {tooltip && <Info className="h-3 w-3 opacity-50" aria-hidden="true" />}
      </span>
      <span className="sr-only">{qualityText}</span>
    </div>
  );

  if (!tooltip) return circle;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{circle}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-center">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface ScoreHeaderProps {
  result: GaitAnalysisResult;
  horseName?: string;
  compositeScore: number | null;
  tempoConsistency: number | null;
  extensionScore: number | null;
  captureQuality?: CaptureQuality;
  analysisMode: "vision" | "audio" | "both";
  detailLevel?: "beginner" | "advanced" | "coach";
  outcome?: DecisionOutcome;
  reasonCodes?: ReasonCode[];
}

export default function ScoreHeader({ result, horseName, compositeScore, tempoConsistency, extensionScore, captureQuality, analysisMode, detailLevel = "advanced", outcome, reasonCodes }: ScoreHeaderProps) {
  const { t, lang } = useLanguage();
  const ModeIcon = ANALYSIS_MODE_ICONS[analysisMode];
  const modeLabel = analysisMode === "vision" ? t("score.modeVision") : analysisMode === "audio" ? t("score.modeAudio") : t("score.modeBoth");

  // Collect unique recapture tips from reason codes
  const recaptureTips = reasonCodes
    ? [...new Set(reasonCodes.map(rc => RECAPTURE_TIPS[rc]).filter(Boolean))]
        .map(key => t(key))
        .slice(0, 4)
    : [];

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-xl font-rubik flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {horseName ? t("score.resultsFor").replace("{name}", horseName) : t("score.resultsDefault")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs gap-1"><ModeIcon className="h-3 w-3" />{modeLabel}</Badge>
            {outcome && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  outcome === "confident" ? "text-primary border-primary/40" :
                  outcome === "inconclusive" ? "text-primary border-primary/40" :
                  outcome === "recapture" ? "text-destructive border-destructive/40" :
                  "text-muted-foreground border-muted"
                }`}
              >
                {t(`outcome.${outcome}`)}
              </Badge>
            )}
            {result.gaitType === "inconclusive" ? (
              <Badge variant="outline" className="text-primary border-primary/40 text-base px-3 py-1">
                {t("score.inconclusive")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-primary border-primary text-base px-3 py-1">
                {lang === "he" ? result.gaitTypeHebrew : result.gaitType.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Low quality warning — non-blocking, results still shown */}
        {outcome === "recapture" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-5 w-5 text-destructive" />
              <span className="font-medium text-destructive">{t("recapture.title")}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{t("recapture.description")}</p>
            {recaptureTips.length > 0 && (
              <ul className="text-sm text-muted-foreground space-y-1 mr-5 list-disc">
                {recaptureTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {outcome === "inconclusive" && recaptureTips.length > 0 && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">{t("score.lowQualityWarning")}</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5 mr-5 list-disc">
              {recaptureTips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-6 py-4">
          <ScoreCircle score={result.overallScore} label={t("score.labelGES")} tooltip={t("score.tooltipGES")} />
          {detailLevel !== "beginner" && (
            <>
              <ScoreCircle score={result.confidence} label={t("score.labelConfidence")} tooltip={t("score.tooltipConfidence")} />
              <ScoreCircle score={result.lateralSync.percentage} label={t("score.labelLateralSync")} tooltip={t("score.tooltipLateralSync")} />
              <ScoreCircle score={result.symmetry.score} label={t("score.labelSI")} tooltip={t("score.tooltipSI")} />
              <ScoreCircle score={compositeScore} label={t("score.labelComposite")} tooltip={t("score.tooltipComposite")} />
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground border-t border-border pt-3">
          <div><p className="font-medium text-foreground">{tempoConsistency ?? "—"}</p><p>{t("score.tempoConsistency")}</p></div>
          <div><p className="font-medium text-foreground">{result.symmetry.score}</p><p>{t("score.symmetry")}</p></div>
          <div><p className="font-medium text-foreground">{extensionScore ?? "—"}</p><p>{t("score.extension")}</p></div>
        </div>

        {(result as any).calibration && (
          <div className="flex items-center gap-2 pt-2">
            <Shield className="h-4 w-4" />
            {(result as any).calibration.confidence > 70 ? (
              <Badge className="bg-primary/15 text-primary border-primary/30">{t("score.calibrated").replace("{method}", (result as any).calibration.calibrationMethod)}</Badge>
            ) : (
              <Badge variant="outline" className="text-primary border-primary/30">{t("score.partialCalib")}</Badge>
            )}
          </div>
        )}

        {captureQuality && captureQuality.score < 3 && (
          <div className="flex items-center gap-2 bg-primary/10 rounded-lg p-3 mt-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">{t("score.captureQualityWarn").replace("{label}", captureQuality.label)}</span>
          </div>
        )}

        {result.audioAnalysis && (result as any).audioAnalysis?.signalToNoiseRatio !== undefined && (result as any).audioAnalysis.signalToNoiseRatio < 10 && (
          <div className="flex items-center gap-2 bg-primary/10 rounded-lg p-3">
            <Mic className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">{t("score.noiseWarn")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
