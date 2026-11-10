import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Upload, Loader2, X, Video, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { extractAudioMetrics } from "@/lib/audioProcessing";
import { extractFrames } from "@/lib/extractFrames";
import { analyzeGait, saveGaitAnalysis, computeVideoHash, findCachedAnalysis } from "@/services/gaitAnalysisService";
import type { GaitAnalysisResult, EnrichedGaitResult } from "@/types/gait";
import GaitResultsDisplay from "@/components/GaitResultsDisplay";

interface Props {
  onComplete?: () => void;
  horseId?: string;
  horseName?: string;
  breedId?: string;
  dmrt3Genotype?: string;
}

const TIMEOUT_MS = 60_000;

export default function QuickScanButton({ onComplete, horseId, horseName, breedId, dmrt3Genotype }: Props) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"idle" | "uploading" | "analyzing" | "done">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EnrichedGaitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [partialGaitType, setPartialGaitType] = useState<string | null>(null);
  const [stage, setStage] = useState("hash");
  const [visibleTimings, setVisibleTimings] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    if (phase !== "analyzing") return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const runQuickScan = useCallback(async (videoFile: File) => {
    setPhase("analyzing");
    setVisibleTimings({}); setStage("hash"); setElapsed(0);
    setError(null);
    setProgress(10);
    setPartialGaitType(null);

    const t0 = performance.now();
    const timings: Record<string, number> = {};
    const mark = (label: string, start: number) => {
      const ms = Math.round(performance.now() - start);
      timings[label] = ms;
      if (!abortRef.current?.signal.aborted) setVisibleTimings({ ...timings });
      // eslint-disable-next-line no-console
      console.log(`[QuickScan] ${label}: ${ms}ms`);
    };
    console.log(`[QuickScan] start — file=${videoFile.name} size=${(videoFile.size / 1024 / 1024).toFixed(2)}MB type=${videoFile.type}`);

    // Create abort controller
    const controller = new AbortController();
    abortRef.current = controller;

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      controller.abort();
      setError(t("quickScan.timeout"));
      setPhase("idle");
      toast.error(t("quickScan.timeout"));
    }, TIMEOUT_MS);

    try {
      // Decode media while the best-effort cache lookup runs.
      const media = Promise.all([
        extractFrames(videoFile, 6, undefined, controller.signal).then(frames => { mark("extract_frames", t0); return frames; }),
        extractAudioMetrics(videoFile).then(audio => { mark("audio_quality", t0); return audio; }),
      ]);
      void media.catch(() => {});
      // Step 1: Check cache first
      setProgress(15);
      const tHash = performance.now();
      const videoHash = await computeVideoHash(videoFile);
      mark("hash", tHash);
      if (controller.signal.aborted) return;

      setStage("cache_lookup");
      const tCache = performance.now();
      const cached = await findCachedAnalysis(videoHash, horseId);
      mark("cache_lookup", tCache);
      if (controller.signal.aborted) return;
      if (cached && (cached.result as EnrichedGaitResult).sourceSelection?.automatic) {
        controller.abort();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setProgress(100);
        const enriched: EnrichedGaitResult = {
          ...cached.result,
          savedAnalysisId: cached.id,
          analysisMode: (cached.result as EnrichedGaitResult).analysisMode || "vision",
        };
        setResult(enriched);
        setPhase("done");
        mark("total", t0);
        console.table(timings);
        toast.success(t("quickScan.cached"));
        onComplete?.();
        return;
      }

      // Step 2: Smart frame extraction — spread across video
      setProgress(25);
      setStage("extract_frames");
      const tFrames = performance.now();
      const [frames, audioMetrics] = await media;

      console.log(`[QuickScan] frames=${frames.length} avgKB=${Math.round(frames.reduce((s, f) => s + f.length, 0) / frames.length / 1024)}`);
      if (controller.signal.aborted) return;

      // Step 3: Vision-only analysis (signal cancels stuck fetch)
      setProgress(50);
      setStage("ai_analysis");
      const tAi = performance.now();
      const analysisResult = await analyzeGait({
        frames,
        audioMetrics: audioMetrics || undefined,
        quickScan: true,
        automaticSources: true,
        horseName,
        breedId,
        dmrt3Genotype,
        trainingLevel: undefined,
        analysisGoal: undefined,
        filmingCondition: undefined,
        notes: undefined,
        signal: controller.signal,
      });
      mark("ai_analysis", tAi);

      if (controller.signal.aborted) return;

      // Show partial result immediately
      if (analysisResult.gaitType) {
        setPartialGaitType(analysisResult.gaitType);
      }

      setProgress(80);

      // Show the successful result immediately; persistence must not hold the spinner.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const completed: EnrichedGaitResult = { ...analysisResult, processingTimeMs: Math.round(performance.now() - t0), stageTimings: { ...timings } };
      setResult(completed); setPhase("done");
      // Save to DB
      let savedId: string | null = null;
      if (user?.id) {
        setStage("db_save");
        const tSave = performance.now();
        savedId = await saveGaitAnalysis(completed, {
          horseName,
          breedId,
          dmrt3Genotype,
          horseId,
        }, completed.analysisMode || "vision", videoHash);
        mark("db_save", tSave);
      }

      if (controller.signal.aborted || abortRef.current !== controller) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setProgress(100);
      const enriched: EnrichedGaitResult = {
        ...analysisResult,
        savedAnalysisId: savedId ?? undefined,
        analysisMode: (analysisResult as EnrichedGaitResult).analysisMode || "vision",
        processingTimeMs: Math.round(performance.now() - t0),
        stageTimings: { ...timings },
      };
      setResult(enriched);
      setPhase("done");
      mark("total", t0);
      console.table(timings);
      toast.success(t("quickScan.done"));
      if (!savedId) toast.warning(lang === "he" ? "התוצאה מוצגת אך לא נשמרה בהיסטוריה" : "Result available, but could not be saved to history");
      onComplete?.();
    } catch (e) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      mark("total_failed", t0);
      console.table(timings);
      console.error("[QuickScan] failed", e);
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if ((e as Error).name === "AbortError") {
        // The timeout handler already surfaced an error toast; just unstick the UI.
        setPhase("idle");
        return;
      }
      const raw = e instanceof Error ? e.message : "";
      const msg = raw.includes("load video") ? t("gait.errorFormat") : raw.includes("fetch") ? t("gait.errorNetwork") : raw || t("gait.errorDefault");
      setError(msg);
      setPhase("idle");
      toast.error(msg);
    }
  }, [user, t, lang, onComplete, horseId, horseName, breedId, dmrt3Genotype]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected?.type.startsWith("video/")) return;
    setFile(selected);
    setPhase("uploading");

    // Generate preview thumbnail
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);

    // Auto-start
    await runQuickScan(selected);
  };

  const reset = () => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhase("idle");
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setPreviewUrl(null);
    setPartialGaitType(null);
  };

  if (phase === "done" && result) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" /> {t("quickScan.badge")}
          </Badge>
          <Button variant="ghost" size="sm" onClick={reset}>{t("quickScan.newScan")}</Button>
        </div>
        <GaitResultsDisplay result={result} analysisMode={result.analysisMode || "vision"} videoFile={file} horseName={horseName} breedId={breedId} analysisId={result.savedAnalysisId || undefined} />
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {phase === "idle" && (
        <Button variant="outline" className="w-full h-auto min-h-16 p-4 justify-start gap-4 text-start whitespace-normal" onClick={() => document.getElementById("quick-scan-input")?.click()}>
          <Zap className="h-6 w-6 text-primary shrink-0" /><span className="flex-1"><span className="block font-semibold">{t("quickScan.title")}</span><span className="block text-sm text-muted-foreground">{lang === "he" ? "בחירה אוטומטית בתנועה ושמע לפי איכות" : "Automatic video/audio selection by quality"}</span></span><Upload className="h-5 w-5 shrink-0" />
        </Button>
      )}

      <input id="quick-scan-input" type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />

      <AnimatePresence>
        {(phase === "uploading" || phase === "analyzing") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {/* Video preview thumbnail */}
                  {previewUrl && (
                    <div className="w-16 h-12 rounded-md overflow-hidden bg-muted shrink-0">
                      <video src={previewUrl} className="w-full h-full object-cover" muted playsInline />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <p className="text-sm font-medium text-foreground truncate">
                        {partialGaitType
                          ? `${t("quickScan.detected")}: ${partialGaitType}`
                          : t("quickScan.analyzing")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{file?.name}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={t("gait.cancelBtn")} onClick={reset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex justify-between gap-3 text-sm"><span>{({ hash: lang === "he" ? "זיהוי הסרטון" : "Hashing video", cache_lookup: t("quickScan.checkingCache"), extract_frames: t("quickScan.extractingFrames"), ai_analysis: t("quickScan.aiAnalyzing"), db_save: t("quickScan.saving") } as Record<string, string>)[stage]}</span><span className="tabular-nums">{elapsed}s</span></div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">{Object.entries(visibleTimings).map(([key, ms]) => <span key={key}>{key}: {(ms/1000).toFixed(1)}s</span>)}</div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
