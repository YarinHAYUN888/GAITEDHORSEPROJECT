import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Upload, X, AlertTriangle, Activity, ChevronDown, Settings2, Volume2, Eye, Layers, VolumeX, Cpu, Users } from "lucide-react";
import PreAnalysisQuestionnaire, { type QuestionnaireAnswers } from "@/components/gait/PreAnalysisQuestionnaire";
import QuickScanButton from "@/components/gait/QuickScanButton";
import { estimateNoiseSNR } from "@/lib/audioProcessing";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import GaitResultsDisplay from "@/components/GaitResultsDisplay";
import GuidedCapture, { type CaptureQuality } from "@/components/GuidedCapture";
import CalibrationWizard, { type CalibrationData } from "@/components/CalibrationWizard";
import AnalysisProgress from "@/components/gait/AnalysisProgress";
import type { AnalysisStageKey } from "@/components/gait/AnalysisProgress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditBadge from "@/components/gait/CreditBadge";
import { breeds } from "@/data/breeds";
import { runGaitPipeline, type PipelineProgress, type PipelineStageStatus } from "@/services/gaitPipelineOrchestrator";
import type { GaitAnalysisResult, EnrichedGaitResult } from "@/types/gait";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import type { CreditTier } from "@/types/pipeline";
import { useSearchParams, Link } from "react-router-dom";
import { useHorses } from "@/hooks/useHorses";

export interface UploadFlowProps {
  userTier: CreditTier;
  onAnalysisComplete: () => void;
  externalResult?: EnrichedGaitResult | null;
  externalAnalysisId?: string | null;
  externalHorseName?: string;
  onNewAnalysis?: () => void;
  analysisMode: "vision" | "audio" | "both";
  setAnalysisMode: (m: "vision" | "audio" | "both") => void;
}

export default function UploadFlow({
  userTier,
  onAnalysisComplete,
  externalResult,
  externalAnalysisId,
  externalHorseName,
  onNewAnalysis,
  analysisMode,
  setAnalysisMode,
}: UploadFlowProps) {
  const { t, dir, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const [scanMode, setScanMode] = useState("quick");
  const { user } = useAuth();
  const { horses, loading: horsesLoading } = useHorses();
  const [selectedHorseId, setSelectedHorseId] = useState<string>("");

  const mapErrorMessage = useCallback((msg: string): string => {
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return t("gait.errorNetwork");
    if (msg.includes("413")) return t("gait.errorTooLarge");
    if (msg.includes("429")) return t("gait.errorTooMany");
    if (msg.includes("timeout") || msg.includes("Timeout")) return t("gait.errorTimeout");
    if (msg.includes("format") || msg.includes("codec")) return t("gait.errorFormat");
    if (msg.includes("קרדיטים")) return msg;
    return msg || t("gait.errorDefault");
  }, [t]);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStageKey>("frames");
  const [progress, setProgress] = useState(0);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageStatus[] | undefined>(undefined);
  const [dmrt3, setDmrt3] = useState<string>("");
  const [horseName, setHorseName] = useState("");
  const [breedId, setBreedId] = useState("");
  const [trainingLevel, setTrainingLevel] = useState("");
  const [analysisGoal, setAnalysisGoal] = useState("");
  const [filmingCondition, setFilmingCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [horseHeight, setHorseHeight] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [noiseWarning, setNoiseWarning] = useState<string | null>(null);
  const [captureQuality, setCaptureQuality] = useState<CaptureQuality | null>(null);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [result, setResult] = useState<EnrichedGaitResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Auto-fill when selecting an existing horse
  const handleHorseSelect = useCallback((horseId: string) => {
    setSelectedHorseId(horseId);
    if (horseId && horseId !== "new") {
      const horse = horses.find(h => h.id === horseId);
      if (horse) {
        setHorseName(horse.name);
        setBreedId(horse.breed_id || "");
        setDmrt3(horse.dmrt3_genotype || "");
      }
    } else {
      setHorseName("");
      setBreedId("");
      setDmrt3("");
    }
  }, [horses]);

  useEffect(() => {
    const id = searchParams.get("horse");
    if (id && horses.some(h => h.id === id)) handleHorseSelect(id);
  }, [searchParams, horses, handleHorseSelect]);

  const selectedBreed = breeds.find((b) => b.id === breedId);

  const videoUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type.startsWith("video/")) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected?.type.startsWith("video/")) {
      setFile(selected);
      setResult(null);
      setError(null);
      setNoiseWarning(null);

    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const myRunId = ++runIdRef.current;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setAnalysisId(null);
    setPipelineStages(undefined);

    try {
      const enrichedResult = await runGaitPipeline({
        file,
        includeAudio: true,
        analysisMode: "both",
        automaticSources: true,
        dmrt3Genotype: dmrt3 || undefined,
        horseName: horseName || undefined,
        breedId: breedId || undefined,
        trainingLevel: trainingLevel || undefined,
        analysisGoal: analysisGoal || undefined,
        filmingCondition: filmingCondition || undefined,
        notes: notes || undefined,
        horseHeightCm: horseHeight ? parseInt(horseHeight) : undefined,
        calibrationData: calibrationData || undefined,
        primaryGoal: questionnaireAnswers?.primaryGoal,
        targetStyle: questionnaireAnswers?.targetStyle,
        primaryUse: questionnaireAnswers?.primaryUse,
        outputPreference: questionnaireAnswers?.outputPreference,
        additionalInfo: questionnaireAnswers?.additionalInfo || undefined,
        horseId: selectedHorseId && selectedHorseId !== "new" ? selectedHorseId : undefined,
        userId: user?.id,
        userTier,
        signal: controller.signal,
        onProgress: (p: PipelineProgress) => {
          if (controller.signal.aborted || myRunId !== runIdRef.current) return;
          setAnalysisStage(p.stage);
          setProgress(p.progress);
          setPipelineStages([...p.stages]);
        },
        onPartialResult: () => { /* Display the final result only after the run settles. */ },
      });

      if (controller.signal.aborted || myRunId !== runIdRef.current) return;

      setResult(enrichedResult);
      setAnalysisId(enrichedResult.savedAnalysisId || null);

      const failedCount = enrichedResult.pipelineStages?.filter((s) => s.status === "failed").length ?? 0;
      if (failedCount > 0) {
        toast.success(t("gait.successPartial").replace("{count}", String(failedCount)));
      } else {
        toast.success(t("gait.successFull"));
      }
      onAnalysisComplete();
    } catch (e) {
      const err = e as any;
      const isAbort = err?.name === "AbortError" || err?.message?.toLowerCase?.().includes("aborted");
      if (isAbort) {
        toast.info(t("gait.cancelled") ?? "Analysis cancelled");
        return;
      }
      const msg = e instanceof Error ? e.message : t("gait.errorDefault");
      setError(mapErrorMessage(msg));
      toast.error(mapErrorMessage(msg));
    } finally {
      if (myRunId === runIdRef.current) {
        setIsAnalyzing(false);
        setProgress(0);
        setAnalysisStage("frames");
      }
    }
  };

  const displayResult = externalResult || result;
  const displayAnalysisId = externalAnalysisId || analysisId;

  return (
    <>
      {!displayResult && <section className="space-y-5 pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />{lang === "he" ? "בחר סוס" : "Select horse"}</div>
        <Select value={selectedHorseId || "new"} onValueChange={handleHorseSelect} disabled={isAnalyzing || horsesLoading}>
          <SelectTrigger className="min-h-11" aria-label={lang === "he" ? "בחר סוס" : "Select horse"}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="new">{lang === "he" ? "ללא שיוך לסוס" : "No horse selected"}</SelectItem>{horses.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
        </Select>
        {!selectedHorseId && <Button asChild variant="link" className="px-0 min-h-11"><Link to="/dashboard">{lang === "he" ? "הסוסים שלי / הוספת סוס" : "My horses / add a horse"}</Link></Button>}
        <Tabs value={scanMode} onValueChange={setScanMode}>
          <TabsList className="grid grid-cols-2 w-full h-auto"><TabsTrigger value="quick" className="min-h-11">{t("quickScan.title")}</TabsTrigger><TabsTrigger value="full" className="min-h-11">{lang === "he" ? "ניתוח מלא" : "Full analysis"}</TabsTrigger></TabsList>
        </Tabs>
        {scanMode === "quick" && <QuickScanButton horseId={selectedHorseId !== "new" ? selectedHorseId : undefined} horseName={horseName} breedId={breedId} dmrt3Genotype={dmrt3} onComplete={onAnalysisComplete} />}
        {scanMode === "full" && !questionnaireAnswers && <PreAnalysisQuestionnaire onComplete={setQuestionnaireAnswers} />}
      </section>}

      {scanMode === "full" && questionnaireAnswers && !displayResult && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="py-6 space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setQuestionnaireAnswers(null)} className="text-muted-foreground">
              {t("gait.backToQuestionnaire")}
            </Button>
          </div>
          <GuidedCapture onQualityChange={setCaptureQuality} />
          <CalibrationWizard onCalibrationComplete={setCalibrationData} horseHeightCm={horseHeight ? parseInt(horseHeight) : undefined} />

          {/* DMRT3 */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="text-sm font-medium text-foreground whitespace-nowrap">{t("gait.dmrt3Label")}</label>
            <Select value={dmrt3} onValueChange={setDmrt3}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t("gait.dmrt3Placeholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("gait.dmrt3None")}</SelectItem>
                <SelectItem value="AA">{t("gait.dmrt3AA")}</SelectItem>
                <SelectItem value="CA">{t("gait.dmrt3CA")}</SelectItem>
                <SelectItem value="CC">{t("gait.dmrt3CC")}</SelectItem>
              </SelectContent>
            </Select>
            {dmrt3 && dmrt3 !== "none" && (
              <Badge variant="outline" className="text-primary border-primary">
                {dmrt3 === "AA" ? t("gait.dmrt3HintAA") : dmrt3 === "CA" ? t("gait.dmrt3HintCA") : t("gait.dmrt3HintCC")}
              </Badge>
            )}
          </div>

          {/* Extended Context */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" />{t("gait.detailsToggle")}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("gait.horseName")}</label>
                  <Input value={horseName} onChange={(e) => setHorseName(e.target.value)} placeholder={t("gait.horseNamePlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("gait.horseHeight")}</label>
                  <Input type="number" value={horseHeight} onChange={(e) => setHorseHeight(e.target.value)} placeholder={t("gait.horseHeightPlaceholder")} min="100" max="200" />
                  <p className="text-xs text-muted-foreground">{t("gait.horseHeightHint")}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("gait.breed")}</label>
                  <Select value={breedId} onValueChange={setBreedId}>
                    <SelectTrigger><SelectValue placeholder={t("gait.breedPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">{t("gait.breedUnknown")}</SelectItem>
                      {breeds.map((b) => (<SelectItem key={b.id} value={b.id}>{b.nameHe} — {b.nameEn}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("gait.trainingLevel")}</label>
                  <Select value={trainingLevel} onValueChange={setTrainingLevel}>
                    <SelectTrigger><SelectValue placeholder={t("gait.trainingLevelPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{t("gait.trainingBeginner")}</SelectItem>
                      <SelectItem value="intermediate">{t("gait.trainingIntermediate")}</SelectItem>
                      <SelectItem value="professional">{t("gait.trainingProfessional")}</SelectItem>
                      <SelectItem value="rehab">{t("gait.trainingRehab")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("gait.analysisGoal")}</label>
                  <Select value={analysisGoal} onValueChange={setAnalysisGoal}>
                    <SelectTrigger><SelectValue placeholder={t("gait.analysisGoalPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="performance">{t("gait.goalPerformance")}</SelectItem>
                      <SelectItem value="diagnosis">{t("gait.goalDiagnosis")}</SelectItem>
                      <SelectItem value="potential">{t("gait.goalPotential")}</SelectItem>
                      <SelectItem value="routine">{t("gait.goalRoutine")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t("gait.filmingCondition")}</label>
                  <Select value={filmingCondition} onValueChange={setFilmingCondition}>
                    <SelectTrigger><SelectValue placeholder={t("gait.filmingConditionPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arena">{t("gait.filmingArena")}</SelectItem>
                      <SelectItem value="open">{t("gait.filmingOpen")}</SelectItem>
                      <SelectItem value="road">{t("gait.filmingRoad")}</SelectItem>
                      <SelectItem value="other">{t("gait.filmingOther")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedBreed && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium text-foreground">{selectedBreed.nameHe} — {selectedBreed.nameEn}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedBreed.gaits.map((g) => (<Badge key={g} variant="secondary" className="text-xs">{g}</Badge>))}
                    <Badge variant="outline" className="text-xs">DMRT3: {selectedBreed.dmrt3.split(" ")[0]}</Badge>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("gait.additionalNotes")}</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("gait.additionalNotesPlaceholder")} rows={3} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 sm:p-14 text-center transition-all cursor-pointer group ${isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
            onClick={() => document.getElementById("video-input")?.click()}
            role="button" tabIndex={0} aria-label={t("gait.dropzoneAriaLabel")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("video-input")?.click(); } }}
          >
            <input id="video-input" type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors mb-4"><Upload className="h-8 w-8 text-primary" /></div>
            <p className="text-foreground font-semibold text-lg mb-1">{t("gait.dropzone")}</p>
            <p className="text-sm text-muted-foreground mb-3">{t("gait.dropzoneClick")}</p>
            <p className="text-xs text-muted-foreground/70">{t("gait.dropzoneFormats")}</p>
          </div>

          {/* File preview */}
          {file && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Video className="h-5 w-5 text-primary" />
                  <div className="min-w-0"><p className="text-sm font-medium break-all">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p></div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setResult(null); setError(null); }} aria-label={t("gait.removeVideo")}><X className="h-4 w-4" /></Button>
              </div>
              {videoUrl && <video ref={videoPreviewRef} src={videoUrl} controls className="w-full rounded-lg max-h-80 bg-muted" />}
            </motion.div>
          )}

          {/* Progress */}
          <AnimatePresence>
            {isAnalyzing && <AnalysisProgress currentStage={analysisStage} progress={progress} stages={pipelineStages} />}
          </AnimatePresence>

          {/* Cancel */}
          {isAnalyzing && (
            <Button variant="outline" className="w-full" onClick={() => abortRef.current?.abort()}>
              <X className="h-4 w-4 mr-2" />{t("gait.cancelBtn") ?? "Cancel analysis"}
            </Button>
          )}

          {/* Analyze */}
          {file && !isAnalyzing && (
            <Button onClick={handleAnalyze} className="w-full font-semibold text-base h-12 min-h-[44px]">
              <Activity className="h-5 w-5 ml-2" />{t("gait.analyzeBtn")}
            </Button>
          )}

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div><p className="text-sm text-destructive font-medium">{error}</p><p className="text-xs text-muted-foreground mt-1">{t("gait.errorRetry")}</p></div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Results */}
      <div ref={resultsRef} aria-live="polite">
        {displayResult && (
          <>
            <Button variant="outline" className="min-h-11 mt-5" onClick={() => { setResult(null); setAnalysisId(null); onNewAnalysis?.(); }}>{t("gait.tabNew")}</Button>
            {displayResult.decisionTrace?.keypointsSource && displayResult.decisionTrace.keypointsSource !== "llm" && (
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="gap-1.5 text-xs">
                  <Cpu className="h-3 w-3" />
                  {displayResult.decisionTrace.keypointsSource === "pose_engine" ? t("pose.engineActive") : t("pose.hybrid")}
                </Badge>
                {displayResult.decisionTrace.poseEngineMeanConfidence != null && (
                  <span className="text-xs text-muted-foreground">{t("pose.confidence")}: {(displayResult.decisionTrace.poseEngineMeanConfidence * 100).toFixed(0)}%</span>
                )}
              </div>
            )}
            <GaitResultsDisplay
              result={displayResult}
              horseName={externalResult ? externalHorseName : horseName}
              breedId={breedId}
              captureQuality={captureQuality || undefined}
              calibrationData={calibrationData || undefined}
              analysisId={displayAnalysisId || undefined}
              conditions={displayResult.conditions}
              pipelineStages={displayResult.pipelineStages}
              pipelineSucceededCount={displayResult.pipelineSucceededCount}
              pipelineTotalCount={displayResult.pipelineTotalCount}
              analysisMode={(displayResult as any).analysisMode || analysisMode}
              videoFile={externalResult ? null : file}
            />
          </>
        )}
      </div>
    </>
  );
}
