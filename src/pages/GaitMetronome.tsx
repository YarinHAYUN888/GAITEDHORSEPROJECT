import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Video, Upload, Play, Pause, SkipBack, Music, Gauge, AlertTriangle, CheckCircle, Loader2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Types ──
interface AudioMetrics {
  bpm: number;
  regularity: number;
  beatCount: number;
  hasWeakBeat: boolean;
  peakAmplitudes: number[];
  beatTimesMs: number[];
}

interface MetronomeSegment {
  startBeat: number;
  endBeat: number;
  quality: "good" | "warning" | "bad";
  note: string;
}

interface SyncIssue {
  atBeat: number;
  severity: "mild" | "moderate" | "severe";
  description: string;
}

interface MetronomeAnalysis {
  rhythmScore: number;
  gaitPattern: string;
  gaitPatternHebrew: string;
  beatType: string;
  idealBPM: number;
  bpmDeviation: number;
  segments: MetronomeSegment[];
  syncIssues: SyncIssue[];
  recommendations: string[];
  summary: string;
}

// ── Audio extraction (reused logic from GaitAnalysis) ──
async function extractAudioWithBeats(file: File): Promise<AudioMetrics | null> {
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const downsampleFactor = Math.floor(sampleRate / 1000);
    const downsampled: number[] = [];
    for (let i = 0; i < channelData.length; i += downsampleFactor) {
      let sum = 0;
      const end = Math.min(i + downsampleFactor, channelData.length);
      for (let j = i; j < end; j++) sum += Math.abs(channelData[j]);
      downsampled.push(sum / (end - i));
    }

    const threshold = Math.max(...downsampled) * 0.3;
    const minPeakDistance = 80;
    const peaks: number[] = [];
    const peakAmplitudes: number[] = [];

    for (let i = 1; i < downsampled.length - 1; i++) {
      if (downsampled[i] > threshold && downsampled[i] > downsampled[i - 1] && downsampled[i] > downsampled[i + 1]) {
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minPeakDistance) {
          peaks.push(i);
          peakAmplitudes.push(downsampled[i]);
        }
      }
    }

    if (peaks.length < 3) { await audioContext.close(); return null; }

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) intervals.push((peaks[i] - peaks[i - 1]) / 1000);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = 60 / avgInterval;

    const stdDev = Math.sqrt(intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length);
    const regularity = Math.max(0, Math.min(100, Math.round((1 - stdDev / avgInterval) * 100)));
    const avgAmp = peakAmplitudes.reduce((a, b) => a + b, 0) / peakAmplitudes.length;
    const hasWeakBeat = peakAmplitudes.some(amp => amp < avgAmp * 0.6);

    // Beat times in ms (relative to start)
    const beatTimesMs = peaks.map(p => Math.round(p)); // peaks are at ~1kHz so index ≈ ms

    await audioContext.close();
    return {
      bpm: Math.round(bpm * 10) / 10,
      regularity,
      beatCount: peaks.length,
      hasWeakBeat,
      peakAmplitudes: peakAmplitudes.slice(0, 30),
      beatTimesMs: beatTimesMs.slice(0, 100),
    };
  } catch (err) {
    console.warn("Audio extraction failed:", err);
    return null;
  }
}

// ── Quality color helper ──
function qualityColor(q: string) {
  if (q === "good") return "text-green-400 bg-green-500/15 border-green-500/30";
  if (q === "warning") return "text-amber-400 bg-amber-500/15 border-amber-500/30";
  return "text-red-400 bg-red-500/15 border-red-500/30";
}

function severityColor(s: string) {
  if (s === "mild") return "border-amber-500/30";
  if (s === "moderate") return "border-orange-500/30";
  return "border-red-500/30";
}

// ── Live Audio Coach (TTS) ──
function useLiveAudioCoach(enabled: boolean, audioMetrics: AudioMetrics | null, analysis: MetronomeAnalysis | null, isPlaying: boolean) {
  const lastSpokenRef = useRef(0);
  const spokenAlertsRef = useRef<Set<string>>(new Set());

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    const now = Date.now();
    // Rate limit: min 5 seconds between utterances
    if (now - lastSpokenRef.current < 5000) return;
    lastSpokenRef.current = now;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "he-IL";
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!enabled || !isPlaying || !audioMetrics || !analysis) return;

    // Check BPM deviation
    if (analysis.bpmDeviation > 15) {
      const alertKey = `bpm-${Math.round(analysis.bpmDeviation)}`;
      if (!spokenAlertsRef.current.has(alertKey)) {
        spokenAlertsRef.current.add(alertKey);
        const direction = audioMetrics.bpm > analysis.idealBPM ? "גבוה" : "נמוך";
        speak(`הקצב ${direction} מדי. ${Math.round(audioMetrics.bpm)} פעימות לדקה במקום ${analysis.idealBPM}. ${direction === "נמוך" ? "הגבר איסוף ודחוף קדימה" : "האט ורכך את הישיבה"}`);
      }
    }

    // Check rhythm regularity
    if (audioMetrics.regularity < 70) {
      const alertKey = `reg-${Math.round(audioMetrics.regularity)}`;
      if (!spokenAlertsRef.current.has(alertKey)) {
        spokenAlertsRef.current.add(alertKey);
        speak(`סדירות הקצב נמוכה. ${audioMetrics.regularity} אחוז. שמרו על קצב אחיד.`);
      }
    }

    // Check for weak beat
    if (audioMetrics.hasWeakBeat) {
      const alertKey = "weak-beat";
      if (!spokenAlertsRef.current.has(alertKey)) {
        spokenAlertsRef.current.add(alertKey);
        speak("זוהתה פעימה חלשה. ייתכן שרגל אחת לא נושאת משקל מלא. בדקו סימטריה.");
      }
    }

    // Sync issues from analysis
    if (analysis.syncIssues?.length > 0) {
      const severeIssues = analysis.syncIssues.filter(i => i.severity === "severe");
      if (severeIssues.length > 0 && !spokenAlertsRef.current.has("sync-severe")) {
        spokenAlertsRef.current.add("sync-severe");
        speak(`בעיית סנכרון חמורה. ${severeIssues[0].description}`);
      }
    }
  }, [enabled, isPlaying, audioMetrics, analysis, speak]);

  // Reset alerts when new analysis
  useEffect(() => {
    spokenAlertsRef.current.clear();
  }, [analysis]);

  return { speak };
}

// ── Main Component ──
export default function GaitMetronome() {
  const [searchParams] = useSearchParams();
  const initialBpm = searchParams.get("bpm");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [horseName, setHorseName] = useState("");
  const [breedId, setBreedId] = useState("");
  const [dmrt3, setDmrt3] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics | null>(null);
  const [analysis, setAnalysis] = useState<MetronomeAnalysis | null>(null);
  const [activeBeatIndex, setActiveBeatIndex] = useState(-1);
  const [coachEnabled, setCoachEnabled] = useState(false);
  const { t } = useLanguage();

  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);

  // Live Audio Coach
  useLiveAudioCoach(coachEnabled, audioMetrics, analysis, isPlaying);

  // Sync beat indicator with video time
  const updateBeatIndicator = useCallback(() => {
    if (!videoRef.current || !audioMetrics?.beatTimesMs.length) return;
    const timeMs = videoRef.current.currentTime * 1000;
    setCurrentTime(videoRef.current.currentTime);

    // Find closest beat
    let closestIdx = -1;
    let minDist = Infinity;
    for (let i = 0; i < audioMetrics.beatTimesMs.length; i++) {
      const dist = Math.abs(audioMetrics.beatTimesMs[i] - timeMs);
      if (dist < minDist) { minDist = dist; closestIdx = i; }
    }
    // Flash if within 50ms
    setActiveBeatIndex(minDist < 50 ? closestIdx : -1);

    if (isPlaying) animFrameRef.current = requestAnimationFrame(updateBeatIndicator);
  }, [audioMetrics, isPlaying]);

  useEffect(() => {
    if (isPlaying) animFrameRef.current = requestAnimationFrame(updateBeatIndicator);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, updateBeatIndicator]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error(t("met.errorVideoOnly")); return; }
    if (file.size > 100 * 1024 * 1024) { toast.error(t("met.errorTooLarge")); return; }
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setAnalysis(null);
    setAudioMetrics(null);
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;
    setIsAnalyzing(true);
    try {
      // Step 1: Extract audio metrics
      toast.info(t("met.extracting"));
      const metrics = await extractAudioWithBeats(videoFile);
      if (!metrics) { toast.error(t("met.noHoofSounds")); setIsAnalyzing(false); return; }
      setAudioMetrics(metrics);

      // Step 2: Send to AI for analysis
      toast.info(t("met.aiAnalyzing"));
      const { data, error } = await supabase.functions.invoke("gait-metronome", {
        body: { audioMetrics: metrics, horseName: horseName || undefined, breedId: breedId || undefined, dmrt3Genotype: dmrt3 || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      toast.success(t("met.success"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("met.errorGeneric"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
  };

  const restart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const handleRateChange = (val: number[]) => {
    const rate = val[0];
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const scoreColor = (s: number) => s >= 80 ? "text-green-400" : s >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="py-12">
      <div className="container max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <Music className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">{t("met.title")}</h1>
          <p className="text-muted-foreground text-lg">{t("met.subtitle")}</p>
        </motion.div>

          {initialBpm && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <Badge variant="secondary" className="text-sm px-4 py-1.5 gap-2">
                <Gauge className="h-4 w-4" />
                BPM יעד מניתוח קודם: <span className="font-bold text-primary">{initialBpm}</span>
              </Badge>
            </div>
          )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Video + Controls */}
          <div className="lg:col-span-2 space-y-4">
            {/* Upload area */}
            {!videoUrl ? (
              <Card className="glass-card">
                <CardContent className="p-12">
                  <label className="flex flex-col items-center justify-center cursor-pointer gap-4">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground text-center">{t("met.uploadPrompt")}</p>
                    <p className="text-xs text-muted-foreground">{t("met.uploadFormats")}</p>
                    <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
                    <Button variant="outline" className="min-h-[44px]" asChild>
                      <span>{t("met.selectFile")}</span>
                    </Button>
                  </label>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Video Player */}
                <Card className="glass-card overflow-hidden relative">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full rounded-t-xl"
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    playsInline
                  />

                  {/* BPM Overlay */}
                  {audioMetrics && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                      <div className={`rounded-lg px-3 py-2 bg-black/70 backdrop-blur text-sm font-mono ${activeBeatIndex >= 0 ? "ring-2 ring-primary scale-110" : ""} transition-all`}>
                        <span className="text-primary font-bold">{audioMetrics.bpm}</span>
                        <span className="text-white/70 mr-1">BPM</span>
                      </div>
                      <div className="rounded-lg px-3 py-1.5 bg-black/70 backdrop-blur text-xs font-mono">
                        <span className="text-white/70">×{playbackRate.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Beat Flash */}
                  {activeBeatIndex >= 0 && (
                    <div className="absolute inset-0 pointer-events-none border-4 border-primary/50 rounded-t-xl animate-pulse" />
                  )}
                </Card>

                {/* Playback Controls */}
                <Card className="glass-card">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" onClick={restart} className="min-h-[44px] min-w-[44px]" aria-label={t("met.restart")}>
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button variant="default" size="icon" onClick={togglePlay} className="min-h-[44px] min-w-[44px]" aria-label={isPlaying ? t("met.pause") : t("met.play")}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <div className="flex-1 text-xs text-muted-foreground font-mono text-center">
                        {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                      </div>
                      <Button variant="outline" onClick={() => { setVideoUrl(""); setVideoFile(null); setAnalysis(null); setAudioMetrics(null); }} className="min-h-[44px] text-sm">
                        {t("met.newVideo")}
                      </Button>
                    </div>

                    {/* Speed Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium flex items-center gap-1"><Gauge className="h-4 w-4" /> {t("met.speed")}</span>
                        <span className="font-mono text-primary">{playbackRate.toFixed(2)}x</span>
                      </div>
                      <Slider value={[playbackRate]} onValueChange={handleRateChange} min={0.1} max={2} step={0.05} className="w-full" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <button onClick={() => handleRateChange([0.25])} className="hover:text-foreground min-h-[44px] px-2">0.25x</button>
                        <button onClick={() => handleRateChange([0.5])} className="hover:text-foreground min-h-[44px] px-2">0.5x</button>
                        <button onClick={() => handleRateChange([1])} className="hover:text-foreground min-h-[44px] px-2">1x</button>
                        <button onClick={() => handleRateChange([1.5])} className="hover:text-foreground min-h-[44px] px-2">1.5x</button>
                        <button onClick={() => handleRateChange([2])} className="hover:text-foreground min-h-[44px] px-2">2x</button>
                      </div>
                    </div>

                    {/* Beat Timeline */}
                    {audioMetrics && audioMetrics.beatTimesMs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{t("met.beatTimeline")}</p>
                        <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                          {audioMetrics.beatTimesMs.map((t, i) => {
                            const pct = (t / (duration * 1000)) * 100;
                            const isWeak = audioMetrics.peakAmplitudes[i] < (audioMetrics.peakAmplitudes.reduce((a, b) => a + b, 0) / audioMetrics.peakAmplitudes.length) * 0.6;
                            const isActive = i === activeBeatIndex;
                            return (
                              <div
                                key={i}
                                className={`absolute top-0 bottom-0 w-0.5 ${isActive ? "bg-primary w-1" : isWeak ? "bg-red-400/60" : "bg-green-400/60"} transition-all`}
                                style={{ left: `${pct}%` }}
                              />
                            );
                          })}
                          {/* Playhead */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
                            style={{ left: `${(currentTime / duration) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Right: Context + Analysis */}
          <div className="space-y-4">
            {/* Context fields */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">{t("met.context")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={horseName} onChange={(e) => setHorseName(e.target.value)} placeholder={t("met.horseName")} />
                <Select value={breedId} onValueChange={setBreedId}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder={t("met.breed")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="icelandic">איסלנדי</SelectItem>
                    <SelectItem value="twh">Tennessee Walking Horse</SelectItem>
                    <SelectItem value="paso_fino">Paso Fino</SelectItem>
                    <SelectItem value="fox_trotter">Missouri Fox Trotter</SelectItem>
                    <SelectItem value="mangalarga">Mangalarga Marchador</SelectItem>
                    <SelectItem value="saddlebred">American Saddlebred</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dmrt3} onValueChange={setDmrt3}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder={t("met.dmrt3")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AA">AA</SelectItem>
                    <SelectItem value="CA">CA</SelectItem>
                    <SelectItem value="CC">CC</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAnalyze} disabled={!videoFile || isAnalyzing} className="w-full min-h-[48px] text-base font-medium">
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin ml-2" /> {t("met.analyzing")}</> : <><Music className="h-4 w-4 ml-2" /> {t("met.analyze")}</>}
                </Button>

                {/* Live Audio Coach Toggle */}
                {analysis && (
                  <Button
                    variant={coachEnabled ? "default" : "outline"}
                    onClick={() => setCoachEnabled(!coachEnabled)}
                    className="w-full min-h-[48px] text-base font-medium"
                  >
                    {coachEnabled ? <Volume2 className="h-4 w-4 ml-2" /> : <VolumeX className="h-4 w-4 ml-2" />}
                    {coachEnabled ? t("met.coachActive") : t("met.coachEnable")}
                  </Button>
                )}
                {coachEnabled && (
                  <p className="text-xs text-muted-foreground text-center">
                    {t("met.coachHint")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Audio Metrics */}
            {audioMetrics && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">{t("met.rawAudio")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center"><p className="text-2xl font-bold text-primary">{audioMetrics.bpm}</p><p className="text-xs text-muted-foreground">BPM</p></div>
                  <div className="text-center"><p className="text-2xl font-bold">{audioMetrics.regularity}</p><p className="text-xs text-muted-foreground">{t("met.regularity")}</p></div>
                  <div className="text-center"><p className="text-2xl font-bold">{audioMetrics.beatCount}</p><p className="text-xs text-muted-foreground">{t("met.beats")}</p></div>
                  <div className="text-center"><p className={`text-2xl font-bold ${audioMetrics.hasWeakBeat ? "text-amber-400" : "text-green-400"}`}>{audioMetrics.hasWeakBeat ? "⚠️" : "✓"}</p><p className="text-xs text-muted-foreground">{t("met.weakBeat")}</p></div>
                </CardContent>
              </Card>
            )}

            {/* AI Analysis Results */}
            {analysis && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Rhythm Score */}
                <Card className="glass-card border-primary/30">
                  <CardContent className="p-6 text-center">
                     <p className="text-sm text-muted-foreground mb-1">{t("met.rhythmScore")}</p>
                     <p className={`text-5xl font-bold ${scoreColor(analysis.rhythmScore)}`}>{analysis.rhythmScore}<span className="text-xl text-muted-foreground">/100</span></p>
                     <div className="mt-2 flex items-center justify-center gap-2">
                       <Badge variant="secondary">{analysis.gaitPatternHebrew}</Badge>
                       <Badge variant="outline">{analysis.beatType}</Badge>
                     </div>
                     {analysis.bpmDeviation > 10 && (
                       <p className="text-xs text-amber-400 mt-2">{t("met.bpmDeviation").replace("{pct}", String(analysis.bpmDeviation)).replace("{ideal}", String(analysis.idealBPM))}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Segments */}
                {analysis.segments.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle className="text-base">{t("met.segments")}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {analysis.segments.map((seg, i) => (
                        <div key={i} className={`rounded-lg border p-3 text-sm ${qualityColor(seg.quality)}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{t("met.beatsRange").replace("{start}", String(seg.startBeat)).replace("{end}", String(seg.endBeat))}</span>
                            {seg.quality === "good" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                          </div>
                          <p className="text-xs mt-1 opacity-80">{seg.note}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Sync Issues */}
                {analysis.syncIssues.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle className="text-base">{t("met.syncIssues")}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {analysis.syncIssues.map((issue, i) => (
                        <div key={i} className={`rounded-lg border p-3 text-sm ${severityColor(issue.severity)}`}>
                          <div className="flex items-center gap-2">
                             <Badge variant="outline" className="text-xs">{issue.severity === "mild" ? t("met.mild") : issue.severity === "moderate" ? t("met.moderate") : t("met.severe")}</Badge>
                             <span className="text-xs text-muted-foreground">{t("met.beatAt").replace("{n}", String(issue.atBeat))}</span>
                          </div>
                          <p className="text-xs mt-1">{issue.description}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Summary + Recommendations */}
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base">{t("met.summary")}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
                    {analysis.recommendations.length > 0 && (
                      <ul className="space-y-1">
                        {analysis.recommendations.map((r, i) => (
                          <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{r}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
