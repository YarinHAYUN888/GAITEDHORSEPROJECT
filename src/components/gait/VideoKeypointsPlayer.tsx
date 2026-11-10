import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, Download, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GaitAnalysisResult } from "@/types/gait";

interface Props {
  videoFile: File;
  result: GaitAnalysisResult;
}

const KEYPOINT_COLORS: Record<string, string> = {
  lf_hoof: "#22c55e", rf_hoof: "#3b82f6",
  lh_hoof: "#f59e0b", rh_hoof: "#ef4444",
  lf_fetlock: "#22c55e", rf_fetlock: "#3b82f6",
  lh_fetlock: "#f59e0b", rh_fetlock: "#ef4444",
  lf_carpus: "#22c55e", rf_carpus: "#3b82f6",
  lh_stifle: "#f59e0b", rh_stifle: "#ef4444",
  lf_shoulder: "#86efac", rf_shoulder: "#93c5fd",
  lh_hip: "#fde047", rh_hip: "#fca5a5",
  poll: "#a78bfa", tail_base: "#c084fc",
  withers: "#e879f9", croup: "#f0abfc",
};

const KEYPOINT_LABELS: Record<string, string> = {
  lf_hoof: "LF Hoof", rf_hoof: "RF Hoof", lh_hoof: "LH Hoof", rh_hoof: "RH Hoof",
  lf_fetlock: "LF Fetlock", rf_fetlock: "RF Fetlock", lh_fetlock: "LH Fetlock", rh_fetlock: "RH Fetlock",
  lf_carpus: "LF Carpus", rf_carpus: "RF Carpus", lh_stifle: "LH Stifle", rh_stifle: "RH Stifle",
  lf_shoulder: "LF Shoulder", rf_shoulder: "RF Shoulder", lh_hip: "LH Hip", rh_hip: "RH Hip",
  poll: "Poll", tail_base: "Tail Base", withers: "Withers", croup: "Croup",
};

const SKELETON_CONNECTIONS: [string, string][] = [
  ["poll", "withers"], ["withers", "croup"], ["croup", "tail_base"],
  ["lf_shoulder", "lf_carpus"], ["lf_carpus", "lf_fetlock"], ["lf_fetlock", "lf_hoof"],
  ["rf_shoulder", "rf_carpus"], ["rf_carpus", "rf_fetlock"], ["rf_fetlock", "rf_hoof"],
  ["lh_hip", "lh_stifle"], ["lh_stifle", "lh_fetlock"], ["lh_fetlock", "lh_hoof"],
  ["rh_hip", "rh_stifle"], ["rh_stifle", "rh_fetlock"], ["rh_fetlock", "rh_hoof"],
  ["withers", "lf_shoulder"], ["withers", "rf_shoulder"],
  ["croup", "lh_hip"], ["croup", "rh_hip"],
];

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

export default memo(function VideoKeypointsPlayer({ videoFile, result }: Props) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showTrails, setShowTrails] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [videoUrl] = useState(() => URL.createObjectURL(videoFile));

  const keypoints = result.keypoints?.data;
  const totalFrames = keypoints?.length ?? 0;

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const getCurrentFrameIndex = useCallback(() => {
    if (!duration || !totalFrames) return 0;
    const idx = Math.floor((currentTime / duration) * totalFrames);
    return Math.min(idx, totalFrames - 1);
  }, [currentTime, duration, totalFrames]);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !keypoints || totalFrames === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const frameIdx = getCurrentFrameIndex();
    const frameData = keypoints[frameIdx];
    if (!frameData?.points) return;

    const w = canvas.width;
    const h = canvas.height;

    // Draw skeleton lines
    if (showSkeleton) {
      for (const [a, b] of SKELETON_CONNECTIONS) {
        const pA = frameData.points[a];
        const pB = frameData.points[b];
        if (!pA || !pB) continue;

        ctx.beginPath();
        ctx.moveTo(pA[0] * w, pA[1] * h);
        ctx.lineTo(pB[0] * w, pB[1] * h);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw trails (last 8 frames for hooves)
    if (showTrails) {
      const hoofs = ["lf_hoof", "rf_hoof", "lh_hoof", "rh_hoof"];
      for (const hoof of hoofs) {
        const color = KEYPOINT_COLORS[hoof] || "#fff";
        ctx.beginPath();
        for (let i = Math.max(0, frameIdx - 8); i <= frameIdx; i++) {
          const pt = keypoints[i]?.points?.[hoof];
          if (!pt) continue;
          const alpha = 0.2 + 0.8 * ((i - (frameIdx - 8)) / 8);
          if (i === Math.max(0, frameIdx - 8)) {
            ctx.moveTo(pt[0] * w, pt[1] * h);
          } else {
            ctx.lineTo(pt[0] * w, pt[1] * h);
          }
          ctx.globalAlpha = alpha;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Draw keypoints with confidence heatmap
    if (showPoints) {
      for (const [name, pt] of Object.entries(frameData.points)) {
        if (!pt) continue;
        const conf = frameData.conf?.[name] ?? 1;
        // Confidence heatmap: green=high, yellow=mid, red=low
        const hue = conf > 0.7 ? 142 : conf > 0.4 ? 38 : 0;
        const color = KEYPOINT_COLORS[name] || `hsl(${hue}, 80%, 50%)`;
        const radius = conf > 0.7 ? 6 : conf > 0.4 ? 5 : 4;
        const isHovered = hoveredPoint === name;

        // Outer glow for hovered
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(pt[0] * w, pt[1] * h, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = `${color}44`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(pt[0] * w, pt[1] * h, isHovered ? radius + 2 : radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0.4, conf);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Outline
        ctx.beginPath();
        ctx.arc(pt[0] * w, pt[1] * h, (isHovered ? radius + 2 : radius) + 1, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        if (showLabels || isHovered) {
          const label = KEYPOINT_LABELS[name] || name;
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = "white";
          ctx.strokeStyle = "rgba(0,0,0,0.7)";
          ctx.lineWidth = 3;
          const textX = pt[0] * w + radius + 4;
          const textY = pt[1] * h - 2;
          ctx.strokeText(label, textX, textY);
          ctx.fillText(label, textX, textY);
          // Confidence below label
          if (isHovered) {
            const confText = `${Math.round(conf * 100)}%`;
            ctx.strokeText(confText, textX, textY + 12);
            ctx.fillText(confText, textX, textY + 12);
          }
        }
      }
    }
  }, [keypoints, totalFrames, getCurrentFrameIndex, showSkeleton, showPoints, showTrails, showLabels, hoveredPoint]);

  // Animation loop — only runs when playing or after seek
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      const video = videoRef.current;
      if (video) {
        setCurrentTime(video.currentTime);
        drawOverlay();
      }
      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(loop);
    } else {
      // Draw once for paused state
      drawOverlay();
    }
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawOverlay, isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); } else { video.play(); }
    setIsPlaying(!isPlaying);
  };

  const seek = (val: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = val[0];
    setCurrentTime(val[0]);
    drawOverlay();
  };

  const skip = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + delta));
  };

  const cycleSpeed = () => {
    const video = videoRef.current;
    const nextIdx = (SPEED_OPTIONS.indexOf(playbackSpeed) + 1) % SPEED_OPTIONS.length;
    const next = SPEED_OPTIONS[nextIdx];
    setPlaybackSpeed(next);
    if (video) video.playbackRate = next;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const exportFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Create export canvas with video + overlay
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = video.videoWidth || video.clientWidth;
    exportCanvas.height = video.videoHeight || video.clientHeight;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

    const link = document.createElement("a");
    link.download = `gait-frame-${getCurrentFrameIndex() + 1}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }, [getCurrentFrameIndex]);

  // Handle mouse move on canvas for hover labels
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!keypoints || totalFrames === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const frameIdx = getCurrentFrameIndex();
    const frameData = keypoints[frameIdx];
    if (!frameData?.points) { setHoveredPoint(null); return; }

    let closest: string | null = null;
    let minDist = 0.03; // threshold
    for (const [name, pt] of Object.entries(frameData.points)) {
      if (!pt) continue;
      const dist = Math.hypot(pt[0] - x, pt[1] - y);
      if (dist < minDist) {
        minDist = dist;
        closest = name;
      }
    }
    setHoveredPoint(closest);
  }, [keypoints, totalFrames, getCurrentFrameIndex]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!keypoints || totalFrames === 0) {
    return null;
  }

  const frameIdx = getCurrentFrameIndex();

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          🎬 {t("videoOverlay.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden bg-black aspect-video cursor-crosshair"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration)}
            onEnded={() => setIsPlaying(false)}
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          {/* Frame + speed indicator */}
          <div className="absolute top-2 right-2 flex gap-1.5">
            <Badge variant="secondary" className="text-[10px] bg-black/60 text-white border-none">
              F{frameIdx + 1}/{totalFrames}
            </Badge>
            {playbackSpeed !== 1 && (
              <Badge variant="secondary" className="text-[10px] bg-primary/80 text-white border-none">
                {playbackSpeed}×
              </Badge>
            )}
          </div>
          {/* Hovered point info */}
          {hoveredPoint && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-[10px] bg-black/70 text-white border-none">
                {KEYPOINT_LABELS[hoveredPoint] || hoveredPoint}
                {keypoints[frameIdx]?.conf?.[hoveredPoint] != null &&
                  ` — ${Math.round((keypoints[frameIdx].conf![hoveredPoint] ?? 0) * 100)}%`
                }
              </Badge>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skip(-0.1)}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skip(0.1)}>
            <SkipForward className="h-4 w-4" />
          </Button>

          {/* Speed control */}
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-mono" onClick={cycleSpeed}>
            <Gauge className="h-3 w-3 mr-1" />
            {playbackSpeed}×
          </Button>

          <div className="flex-1 px-2">
            <Slider
              value={[currentTime]}
              max={duration || 1}
              step={0.01}
              onValueChange={seek}
              className="cursor-pointer"
            />
          </div>

          <span className="text-xs text-muted-foreground tabular-nums min-w-[70px] text-center">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Export frame */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportFrame} title={t("videoOverlay.exportFrame")}>
            <Download className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Toggle options */}
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Switch checked={showPoints} onCheckedChange={setShowPoints} className="scale-75" />
            <span className="text-muted-foreground">{t("videoOverlay.points")}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Switch checked={showSkeleton} onCheckedChange={setShowSkeleton} className="scale-75" />
            <span className="text-muted-foreground">{t("videoOverlay.skeleton")}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Switch checked={showTrails} onCheckedChange={setShowTrails} className="scale-75" />
            <span className="text-muted-foreground">{t("videoOverlay.trails")}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Switch checked={showLabels} onCheckedChange={setShowLabels} className="scale-75" />
            <span className="text-muted-foreground">{t("videoOverlay.labels")}</span>
          </label>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: t("videoOverlay.frontLeft"), color: "#22c55e" },
            { label: t("videoOverlay.frontRight"), color: "#3b82f6" },
            { label: t("videoOverlay.hindLeft"), color: "#f59e0b" },
            { label: t("videoOverlay.hindRight"), color: "#ef4444" },
            { label: t("videoOverlay.spine"), color: "#a78bfa" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
          {/* Confidence legend */}
          <Separator orientation="vertical" className="h-4 mx-1" />
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-muted-foreground">&gt;70%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-muted-foreground">40-70%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-muted-foreground">&lt;40%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
