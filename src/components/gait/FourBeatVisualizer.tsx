import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Camera, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LEG_COLORS, LEG_LABELS, LEG_LABELS_SHORT,
  getFourBeatOrder, getGaitMeta,
  evaluateSinglefootQuality, type SinglefootQualityMetrics,
} from "@/lib/gaitCalculations";
import type { GaitAnalysisResult } from "@/types/gait";

interface Props {
  result: GaitAnalysisResult;
  /** Video file for frame extraction (optional) */
  videoFile?: File | null;
}

const QUALITY_COLORS: Record<string, string> = {
  premium: "text-emerald-400",
  good: "text-primary",
  developing: "text-amber-400",
  rough: "text-destructive",
};

const QUALITY_BG: Record<string, string> = {
  premium: "bg-emerald-500/15 border-emerald-500/30",
  good: "bg-primary/15 border-primary/30",
  developing: "bg-amber-500/15 border-amber-500/30",
  rough: "bg-destructive/15 border-destructive/30",
};

/**
 * FourBeatVisualizer — Shows the four-beat footfall pattern for singlefoot and similar gaits.
 * 
 * Displays:
 * 1. Beat order diagram with timing
 * 2. Video frame thumbnails at each beat moment (if video available)
 * 3. Singlefoot quality assessment
 * 4. Lateral dissociation visualization
 * 
 * Based on research:
 * - Vincelette 2023: "Alternative Lateral Horse Gaits" 
 * - Nicodemus & Clayton 2003: Temporal variables of four-beat lateral gaits
 */
export default memo(function FourBeatVisualizer({ result, videoFile }: Props) {
  const [beatFrames, setBeatFrames] = useState<string[]>([]);
  const [activeBeat, setActiveBeat] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const meta = useMemo(() => getGaitMeta(result.gaitType), [result.gaitType]);
  const beatOrder = useMemo(() => getFourBeatOrder(result.gaitType), [result.gaitType]);

  const qualityMetrics = useMemo(() => evaluateSinglefootQuality(
    result.beatPattern,
    result.lateralSync?.percentage,
    result.audioAnalysis?.rhythmRegularity,
    result.kinematicMetrics?.overreachDistance,
    result.kinematicMetrics?.phaseLagMs as any,
  ), [result]);

  // Extract 4 frames from video at beat positions
  const extractBeatFrames = useCallback(async () => {
    if (!videoFile || beatOrder.length < 4) return;
    setIsExtracting(true);
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(videoFile);
      video.src = url;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
      });

      const duration = video.duration;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const frames: string[] = [];

      for (let i = 0; i < Math.min(4, beatOrder.length); i++) {
        const beatTime = (duration * beatOrder[i].phaseOffset) + (duration * 0.1); // offset slightly into the video
        const clampedTime = Math.min(Math.max(0, beatTime), duration - 0.1);
        video.currentTime = clampedTime;
        
        await new Promise<void>((resolve) => {
          video.onseeked = () => {
            const w = Math.min(video.videoWidth, 480);
            const h = Math.round(w * video.videoHeight / video.videoWidth);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            frames.push(canvas.toDataURL("image/jpeg", 0.7));
            resolve();
          };
        });
      }

      URL.revokeObjectURL(url);
      setBeatFrames(frames);
    } catch (err) {
      console.error("Failed to extract beat frames:", err);
    } finally {
      setIsExtracting(false);
    }
  }, [videoFile, beatOrder]);

  // Auto-extract frames on mount if video available
  useEffect(() => {
    if (videoFile && beatFrames.length === 0) {
      extractBeatFrames();
    }
  }, [videoFile, extractBeatFrames, beatFrames.length]);

  // Animation — cycle through beats
  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setActiveBeat(prev => (prev + 1) % 4);
    }, 600);
    return () => clearInterval(interval);
  }, [isAnimating]);

  // Only show for 4-beat gaits
  if (!meta || meta.beats !== 4 || beatOrder.length !== 4) return null;

  const tierLabel: Record<string, string> = {
    premium: "מעולה ⭐",
    good: "טוב ✓",
    developing: "מתפתח",
    rough: "גס",
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            🦶 ניתוח ארבע-פעימות — {meta.nameHe} ({meta.nameEn})
          </span>
          <Badge variant="outline" className={`${QUALITY_BG[qualityMetrics.qualityTier]} text-xs`}>
            {tierLabel[qualityMetrics.qualityTier]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Beat Order Visualization */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            סדר נחיתת הרגליים — רצף לטרלי (מחקר: Vincelette 2023)
          </p>
          <div className="flex items-center justify-center gap-2">
            {beatOrder.map((beat, i) => (
              <div key={beat.legKey} className="flex items-center gap-2">
                <button
                  onClick={() => setActiveBeat(i)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all min-w-[72px] ${
                    activeBeat === i
                      ? "border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/10"
                      : "border-border hover:border-primary/40 bg-card/50"
                  }`}
                >
                  <span className="text-lg font-bold" style={{ color: beat.color }}>
                    {i + 1}
                  </span>
                  <span className="text-[10px] font-medium text-foreground">{beat.label}</span>
                  <div
                    className="w-4 h-4 rounded-full border-2"
                    style={{
                      backgroundColor: activeBeat === i ? beat.color : "transparent",
                      borderColor: beat.color,
                    }}
                  />
                </button>
                {i < 3 && (
                  <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Timing bar */}
          <div className="relative h-8 bg-muted/30 rounded-lg overflow-hidden mx-4 mt-2">
            {beatOrder.map((beat, i) => (
              <div
                key={beat.legKey}
                className="absolute top-0 bottom-0 flex items-center justify-center transition-all"
                style={{
                  right: `${beat.phaseOffset * 100}%`,
                  width: "25%",
                  backgroundColor: activeBeat === i ? `${beat.color}30` : "transparent",
                }}
              >
                <div
                  className="w-1.5 h-full rounded-full"
                  style={{ backgroundColor: beat.color, opacity: activeBeat === i ? 1 : 0.4 }}
                />
              </div>
            ))}
            {/* Moving cursor */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 transition-all duration-500"
              style={{ right: `${(activeBeat / 4) * 100}%` }}
            />
          </div>

          <div className="flex justify-center gap-2 mt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAnimating(!isAnimating)}
              className="text-xs gap-1"
            >
              <Play className={`h-3 w-3 ${isAnimating ? "text-primary" : ""}`} />
              {isAnimating ? "עצור" : "הפעל אנימציה"}
            </Button>
          </div>
        </div>

        {/* Video Frame Thumbnails */}
        {beatFrames.length === 4 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <Camera className="h-3 w-3" /> צילומי מסך מהסרטון — כל פעימה
            </p>
            <div className="grid grid-cols-4 gap-2">
              {beatFrames.map((frame, i) => (
                <button
                  key={i}
                  onClick={() => setActiveBeat(i)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-video ${
                    activeBeat === i
                      ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                      : "border-border/50 hover:border-primary/40"
                  }`}
                >
                  <img
                    src={frame}
                    alt={`פעימה ${i + 1} — ${beatOrder[i]?.label}`}
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute bottom-0 inset-x-0 h-6 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: `${beatOrder[i]?.color}CC` }}
                  >
                    פעימה {i + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {isExtracting && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">מחלץ פריימים מהסרטון...</span>
          </div>
        )}

        {/* Quality Assessment */}
        <div className={`rounded-xl border p-4 space-y-3 ${QUALITY_BG[qualityMetrics.qualityTier]}`}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">הערכת איכות סינגלפוט</h4>
            <span className={`text-sm font-bold ${QUALITY_COLORS[qualityMetrics.qualityTier]}`}>
              {tierLabel[qualityMetrics.qualityTier]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{qualityMetrics.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">אחידות פעימות</span>
                <span className="font-semibold text-foreground">{qualityMetrics.beatEvenness}%</span>
              </div>
              <Progress value={qualityMetrics.beatEvenness} className="h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">חלקות ראש</span>
                <span className="font-semibold text-foreground">{qualityMetrics.headNodScore}%</span>
              </div>
              <Progress value={qualityMetrics.headNodScore} className="h-1.5" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="text-xs">
              {qualityMetrics.isTrueSinglefoot ? "✓ סינגלפוט אמיתי" : "⚠ לא סינגלפוט מלא"}
            </Badge>
            {qualityMetrics.lateralDissociationMs > 0 && (
              <Badge variant="outline" className="text-xs">
                פיצול לטרלי: {Math.round(qualityMetrics.lateralDissociationMs)} ms
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              אוברסטרייד: {
                qualityMetrics.overstrideQuality === "full" ? "מלא" :
                qualityMetrics.overstrideQuality === "moderate" ? "בינוני" :
                qualityMetrics.overstrideQuality === "slight" ? "קל" : "אין"
              }
            </Badge>
          </div>
        </div>

        {/* Research reference */}
        <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
          מבוסס על: Vincelette 2023 (MDPI Animals), Nicodemus & Clayton 2003 — סיווג ארבע-פעימות לטרלי
        </p>
      </CardContent>
    </Card>
  );
});
