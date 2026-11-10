import { lazy, Suspense, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Activity, Ruler, Loader2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GaitAnalysisResult, DetectConditionsResult, EnrichedGaitResult } from "@/types/gait";
import type { CaptureQuality } from "@/components/GuidedCapture";
import { calculatePercentileRank, GAIT_BENCHMARKS } from "@/data/gaitBenchmarks";
import { mapToFEIFScores, getRelevantFEIFTests, type FEIFScoreResult } from "@/data/feifStandards";
import type { CalibrationData } from "@/components/CalibrationWizard";
import OwnerEvidenceSummary from "@/components/gait/OwnerEvidenceSummary";
import { normalizeGaitResult } from "@/lib/normalizeGaitResult";
import { isGaitResultValid } from "@/lib/gaitResultValidation";
import ScoreHeader from "@/components/gait/results/ScoreHeader";
import OwnerInsightCard from "@/components/gait/results/OwnerInsightCard";
import AIActionButtons from "@/components/gait/results/AIActionButtons";
import AudioDetailsCard from "@/components/gait/results/AudioDetailsCard";
import MotionMetricsCards from "@/components/gait/results/MotionMetricsCards";
import DetailLevelToggle, { useDetailLevel, type DetailLevel } from "@/components/gait/DetailLevelToggle";
import ActionPlanCard from "@/components/gait/ActionPlanCard";
import { useLanguage } from "@/contexts/LanguageContext";

const FeedbackPanel = lazy(() => import("@/components/gait/FeedbackPanel"));
const ValidationPanel = lazy(() => import("@/components/gait/ValidationPanel"));
const GaitSyncChart = lazy(() => import("@/components/GaitSyncChart"));
const KinematicChart = lazy(() => import("@/components/KinematicChart"));
const GaitBenchmarkCard = lazy(() => import("@/components/GaitBenchmarkCard"));
const FEIFScoreCard = lazy(() => import("@/components/FEIFScoreCard"));
const QualitySeal = lazy(() => import("@/components/QualitySeal"));
const BiomechChart = lazy(() => import("@/components/BiomechChart"));
const WholeBodyBiomechPanel = lazy(() => import("@/components/biomech/WholeBodyBiomechPanel"));
const ConditionsPanel = lazy(() => import("@/components/gait/ConditionsPanel"));
const FourBeatVisualizer = lazy(() => import("@/components/gait/FourBeatVisualizer"));
const VisualBiomechAnalysis = lazy(() => import("@/components/biomech/VisualBiomechAnalysis"));
const FootfallEventPlot = lazy(() => import("@/components/gait/FootfallEventPlot"));
const QualityMeter = lazy(() => import("@/components/gait/QualityMeter"));
const ClassificationExplainer = lazy(() => import("@/components/gait/ClassificationExplainer"));
const ExportPanel = lazy(() => import("@/components/gait/ExportPanel"));
const StrideAnalysisCard = lazy(() => import("@/components/gait/StrideAnalysisCard"));
const VSICard = lazy(() => import("@/components/gait/VSICard"));
const StrideConsistencyCard = lazy(() => import("@/components/gait/StrideConsistencyCard"));
const CameraQualityCard = lazy(() => import("@/components/gait/CameraQualityCard"));
const GRFCard = lazy(() => import("@/components/gait/GRFCard"));
const VetReportCard = lazy(() => import("@/components/gait/VetReportCard"));
const BenchmarkCard = lazy(() => import("@/components/gait/BenchmarkCard"));
const VideoKeypointsPlayer = lazy(() => import("@/components/gait/VideoKeypointsPlayer"));
const LegLoadDiagram = lazy(() => import("@/components/gait/LegLoadDiagram"));

const extensionMap: Record<string, number> = { poor: 25, fair: 50, good: 75, excellent: 100 };

function LazyFallback() {
  return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}

type ResultsProps = { result: GaitAnalysisResult; horseName?: string; breedId?: string; captureQuality?: CaptureQuality; calibrationData?: CalibrationData; analysisId?: string; humanValidated?: boolean; conditions?: DetectConditionsResult; pipelineStages?: Array<{ key: string; status: string; error?: string }>; pipelineSucceededCount?: number; pipelineTotalCount?: number; analysisMode?: "vision" | "audio" | "both"; videoFile?: File | null; criticWarnings?: string[] };

export default memo(function GaitResultsDisplay(props: ResultsProps) {
  const { lang } = useLanguage();
  if (!isGaitResultValid(props.result)) return <div role="alert" className="my-6 border border-destructive/30 rounded-lg p-5 space-y-2"><h2 className="font-semibold text-destructive">{lang === "he" ? "לא ניתן להציג תוצאה זו בבטחה" : "This result cannot be displayed reliably"}</h2><p className="text-sm text-muted-foreground">{lang === "he" ? "הנתונים חסרים או לא תקינים. בחרו ניתוח חדש ונסו סרטון נוסף מהצד; לא מוצגים ציונים מומצאים." : "Data is incomplete or invalid. Start a new analysis with another side-view video; no scores have been invented."}</p></div>;
  return <ValidatedResults {...props} />;
});

function ValidatedResults({ result, horseName, breedId, captureQuality, calibrationData, analysisId, humanValidated, conditions, pipelineStages, pipelineSucceededCount, pipelineTotalCount, analysisMode = "both", videoFile, criticWarnings }: ResultsProps) {
  result = normalizeGaitResult(result);
  const mode = (result as EnrichedGaitResult).analysisMode;
  analysisMode = mode === "vision" || mode === "audio" || mode === "both" ? mode : analysisMode;
  const [detailLevel, setDetailLevel] = useDetailLevel();
  const { t } = useLanguage();

  const compositeScore = useMemo(() => {
    const tempoConsistency = result.audioAnalysis?.rhythmRegularity ?? null;
    const extScore = extensionMap[result.extension.quality] ?? null;
    if (tempoConsistency === null || extScore === null || result.symmetry.score == null || !Number.isFinite(tempoConsistency)) return null;
    return Math.round(tempoConsistency * 0.35 + result.symmetry.score * 0.35 + extScore * 0.30);
  }, [result.audioAnalysis?.rhythmRegularity, result.symmetry.score, result.extension.quality]);

  const tempoConsistency = result.audioAnalysis?.rhythmRegularity ?? null;
  const extensionScore = extensionMap[result.extension.quality] ?? null;

  const percentileResults = useMemo(
    () => breedId ? calculatePercentileRank(breedId, result.gaitType, {
      lateralSync: result.lateralSync.percentage,
      symmetry: result.symmetry.score,
      ...(result.audioAnalysis ? { bpm: result.audioAnalysis.detectedBPM, rhythmRegularity: result.audioAnalysis.rhythmRegularity } : {}),
    }) : [],
    [breedId, result.gaitType, result.lateralSync.percentage, result.symmetry.score, result.audioAnalysis?.detectedBPM, result.audioAnalysis?.rhythmRegularity]
  );

  const benchmarkSet = useMemo(
    () => breedId ? GAIT_BENCHMARKS.find(b => b.breedId === breedId) : null,
    [breedId]
  );

  const feifScores = useMemo(() => {
    const relevantTests = getRelevantFEIFTests(result.gaitType);
    return relevantTests
      .map(testId => mapToFEIFScores(testId, {
        rhythmRegularity: result.audioAnalysis?.rhythmRegularity,
        symmetryScore: result.symmetry.score,
        lateralSync: result.lateralSync.percentage,
        bpm: result.audioAnalysis?.detectedBPM,
        extensionQuality: extensionMap[result.extension.quality],
        overallScore: result.overallScore,
      }))
      .filter((s): s is FEIFScoreResult => s !== null);
  }, [result.gaitType, result.audioAnalysis?.rhythmRegularity, result.symmetry.score, result.lateralSync.percentage, result.audioAnalysis?.detectedBPM, result.extension.quality, result.overallScore]);

  const qualitySealData = useMemo(() => {
    // Compute windowQualityAvg from biomech windows
    let windowQualityAvg: number | undefined;
    if (result.biomechMetrics?.windows && result.biomechMetrics.windows.length > 0) {
      const qualities = result.biomechMetrics.windows.map(w => w.quality * 100);
      windowQualityAvg = qualities.reduce((a, b) => a + b, 0) / qualities.length;
    }

    // Compute occlusionRate from per-keypoint visibility in biomech
    let occlusionRate: number | undefined;
    const biomech = result.biomechMetrics;
    if (biomech?.quality?.missingRate) {
      const rates = Object.values(biomech.quality.missingRate);
      if (rates.length > 0) {
        occlusionRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      }
    }

    return {
      visionAudioAgreement: result.multiModalFusion?.agreement ?? true,
      fusedConfidence: result.multiModalFusion?.fusedConfidence ?? result.confidence,
      calibrationConfidence: calibrationData?.confidence ?? (result as any).calibration?.confidence ?? 0,
      rhythmRegularity: result.audioAnalysis?.rhythmRegularity ?? 70,
      symmetryScore: result.symmetry.score,
      captureQualityScore: captureQuality?.score ?? 2,
      hrRecovery: null as { bpm: number; isHealthy: boolean } | null,
      windowQualityAvg,
      occlusionRate,
    };
  }, [result.multiModalFusion, result.confidence, calibrationData, result.audioAnalysis?.rhythmRegularity, result.symmetry.score, captureQuality, result.biomechMetrics]);

  const isCoachLevel = detailLevel === "coach";
  const isAdvancedPlus = detailLevel !== "beginner";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
      <ScoreHeader
        result={result}
        horseName={horseName}
        compositeScore={compositeScore}
        tempoConsistency={tempoConsistency}
        extensionScore={extensionScore}
        captureQuality={captureQuality}
        analysisMode={analysisMode}
        detailLevel={detailLevel}
        outcome={(result as any).decision?.outcome}
        reasonCodes={(result as any).decision?.reasonCodes}
      />

      <OwnerInsightCard result={result} horseName={horseName} analysisId={analysisId} />

      <OwnerEvidenceSummary result={result} videoFile={videoFile} analysisId={analysisId} />

      <DetailLevelToggle value={detailLevel} onChange={setDetailLevel} />

      <AIActionButtons result={result} horseName={horseName} />

      {/* Action Plan — replaces old training recommendations */}
      <ActionPlanCard result={result} detailLevel={detailLevel} />

      {/* Classification Explainer — advanced+ */}
      {isAdvancedPlus && result.biomechMetrics?.gait && (
        <Suspense fallback={<LazyFallback />}>
          <ClassificationExplainer
            classification={result.biomechMetrics.gait}
            criticWarnings={criticWarnings}
            detailLevel={detailLevel}
            evidenceFor={(result as any).explainability?.evidenceFor}
            evidenceAgainst={(result as any).explainability?.evidenceAgainst}
          />
        </Suspense>
      )}

      {/* Export Panel — coach only */}
      {isCoachLevel && (
        <Suspense fallback={<LazyFallback />}>
          <ExportPanel result={result as any} horseName={horseName} analysisId={analysisId} />
        </Suspense>
      )}

      {/* Quality Meter — coach only */}
      {isCoachLevel && result.biomechMetrics?.windows && result.biomechMetrics.windows.length > 0 && (
        <Suspense fallback={<LazyFallback />}>
          <QualityMeter
            windows={result.biomechMetrics.windows.map((w, i) => ({
              index: i,
              missingPct: 1 - w.quality,
              blurProxy: w.features.strideVariability / 100,
              cameraMotion: w.features.headPelvisStability / 100,
              horseStability: w.features.contactEventConfidence,
            }))}
          />
        </Suspense>
      )}

      {result.multiModalFusion && !result.multiModalFusion.agreement && (
        <Card className="glass-card border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive"><Zap className="h-4 w-4" />{t("results.visionAudioConflict")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-4 text-sm">
              <Badge variant="outline">👁️ {t("results.eye")}: {result.multiModalFusion.visionGaitType}</Badge>
              <Badge variant="outline">👂 {t("results.ear")}: {result.multiModalFusion.audioGaitType}</Badge>
            </div>
            <p className="text-sm text-destructive/80">{result.multiModalFusion.conflictDescription}</p>
            <p className="text-xs text-muted-foreground">{t("results.weightedConfidence")}: {result.multiModalFusion.fusedConfidence}% | {t("results.dominantSource")}: {result.multiModalFusion.dominantModality}</p>

            {/* Agreement breakdown */}
            {result.multiModalFusion.agreementScoreOverall != null && (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-medium text-foreground">{t("results.overallAgreement")}: {result.multiModalFusion.agreementScoreOverall}%</p>
                {result.multiModalFusion.agreementBreakdown && (
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    {Object.entries(result.multiModalFusion.agreementBreakdown).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(val as number) * 100}%` }} />
                        </div>
                        <span className="text-muted-foreground">{key}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Conflict reason codes */}
            {result.multiModalFusion.conflictReasonCodes && result.multiModalFusion.conflictReasonCodes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {result.multiModalFusion.conflictReasonCodes.map((code) => (
                  <Badge key={code} variant="outline" className="text-[10px] text-destructive border-destructive/30">{code}</Badge>
                ))}
              </div>
            )}

            {/* Limitations tooltip */}
            {result.multiModalFusion.limitations && result.multiModalFusion.limitations.length > 0 && (
              <p className="text-[10px] text-muted-foreground/70">⚠️ {t("results.limitations")}: {result.multiModalFusion.limitations.join(", ")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {isAdvancedPlus && (
        <Suspense fallback={<LazyFallback />}>
          {percentileResults.length > 0 && benchmarkSet && (
            <GaitBenchmarkCard results={percentileResults} breedNameHe={benchmarkSet.breedNameHe} gaitTypeHe={benchmarkSet.gaitTypeHe} />
          )}
          {result.multiModalFusion && result.audioAnalysis && captureQuality && <QualitySeal data={qualitySealData} />}
          {feifScores.length > 0 && <FEIFScoreCard scores={feifScores} />}
        </Suspense>
      )}

      {/* Video Keypoints Overlay Player — coach only */}
      {isAdvancedPlus && videoFile && (
        <Suspense fallback={<LazyFallback />}>
          <VideoKeypointsPlayer videoFile={videoFile} result={result} />
        </Suspense>
      )}

      {/* Visual AI Biomech Analysis — coach only */}
      {isCoachLevel && videoFile && (
        <Suspense fallback={<LazyFallback />}>
          <VisualBiomechAnalysis videoFile={videoFile} gaitType={result.gaitType} breedId={breedId} />
        </Suspense>
      )}

      {/* Four-Beat Visualizer */}
      {isAdvancedPlus && (
        <Suspense fallback={<LazyFallback />}>
          <FourBeatVisualizer result={result} videoFile={videoFile} />
        </Suspense>
      )}

      {/* Stride Segmentation — advanced+ */}
      {isAdvancedPlus && (result as any).strideSegmentation?.strides?.length > 0 && (
        <Suspense fallback={<LazyFallback />}>
          <StrideAnalysisCard data={(result as any).strideSegmentation} />
        </Suspense>
      )}

      {/* Multi-Stride Consistency — advanced+ */}
      {isAdvancedPlus && (result as any).strideSegmentation?.strides?.length >= 2 && (
        <Suspense fallback={<LazyFallback />}>
          <StrideConsistencyCard data={(result as any).strideSegmentation} />
        </Suspense>
      )}

      {/* VSI — Vertical Symmetry Index — advanced+ */}
      {isAdvancedPlus && result.headPelvisMetrics && (result.headPelvisMetrics.headVSI !== undefined || result.headPelvisMetrics.pelvisVSI !== undefined) && (
        <Suspense fallback={<LazyFallback />}>
          <VSICard metrics={result.headPelvisMetrics} />
        </Suspense>
      )}

      {/* Camera Quality Card — advanced+ */}
      {isAdvancedPlus && result.biomechMetrics?.cameraMotion && (
        <Suspense fallback={<LazyFallback />}>
          <CameraQualityCard metrics={result.biomechMetrics.cameraMotion} />
        </Suspense>
      )}

      {/* GRF Card — advanced+ */}
      {isAdvancedPlus && result.biomechMetrics?.grfMetrics && (
        <Suspense fallback={<LazyFallback />}>
          <GRFCard metrics={result.biomechMetrics.grfMetrics} />
        </Suspense>
      )}

      {/* Leg Load Diagram — visual horse silhouette */}
      {isAdvancedPlus && (result.biomechMetrics?.grfMetrics || result.suspensionAnalysis) && (
        <Suspense fallback={<LazyFallback />}>
          <LegLoadDiagram result={result} />
        </Suspense>
      )}

      {isCoachLevel && result.biomechMetrics?.contactEvents && result.biomechMetrics.gait && (
        <Suspense fallback={<LazyFallback />}>
          <FootfallEventPlot
            contacts={result.biomechMetrics.contactEvents}
            beatEvenness={result.biomechMetrics.windows?.[0]?.features?.beatEvenness ?? 0}
            footfallOrder={result.biomechMetrics.windows?.[0]?.features?.footfallOrder ?? "unknown"}
          />
        </Suspense>
      )}

      {isAdvancedPlus && (
        <Suspense fallback={<LazyFallback />}>
          <GaitSyncChart beatTracker={result.beatTracker} />

          {result.kinematicMetrics && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground"><Ruler className="h-5 w-5 text-primary" />{t("results.kinematicMetrics")}</h3>
              <KinematicChart metrics={result.kinematicMetrics} />
            </div>
          )}

          {isCoachLevel && (result.biomechMetrics || result.headPelvisMetrics || result.backMetrics) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground"><Activity className="h-5 w-5 text-primary" />{t("results.advancedBiomech")}</h3>
              <BiomechChart biomechMetrics={result.biomechMetrics} headPelvisMetrics={result.headPelvisMetrics} backMetrics={result.backMetrics} criticWarnings={criticWarnings} />
              <WholeBodyBiomechPanel biomechMetrics={result.biomechMetrics} backMetrics={result.backMetrics} headPelvisMetrics={result.headPelvisMetrics} />
            </div>
          )}

          {conditions && <ConditionsPanel conditions={conditions} />}

          {pipelineSucceededCount !== undefined && pipelineTotalCount !== undefined && (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs">
                {t("results.pipelineStatus").replace("{succeeded}", String(pipelineSucceededCount)).replace("{total}", String(pipelineTotalCount))}
              </Badge>
            </div>
          )}
        </Suspense>
      )}

      {isAdvancedPlus && <AudioDetailsCard audioAnalysis={result.audioAnalysis} analysisMode={analysisMode} />}

      {isAdvancedPlus && <MotionMetricsCards result={result} analysisMode={analysisMode} />}

      {result.breedSpecificNotes && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("results.breedNotes")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{result.breedSpecificNotes}</p></CardContent>
        </Card>
      )}

      {result.goalFocusedSummary && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("results.goalFocusedSummary")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{result.goalFocusedSummary}</p></CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("results.analysisSummary")}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p></CardContent>
      </Card>

      {/* AI-Powered Tools */}
      {analysisId && (
        <Suspense fallback={<LazyFallback />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VetReportCard analysisId={analysisId} horseId={undefined} />
            <BenchmarkCard analysisId={analysisId} breedId={breedId} />
          </div>
        </Suspense>
      )}

      <Suspense fallback={<LazyFallback />}>
        <FeedbackPanel
          analysisId={analysisId}
          detectedGaitType={result.gaitType}
          detectedGaitTypeHebrew={result.gaitTypeHebrew}
          humanValidated={humanValidated}
        />
        <ValidationPanel analysisId={analysisId} detectedGaitType={result.gaitType} biomechMetrics={result.biomechMetrics} />
      </Suspense>
    </motion.div>
  );
}
