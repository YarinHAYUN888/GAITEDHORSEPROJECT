import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { GaitAnalysisResult } from "@/types/gait";

interface Props {
  result: GaitAnalysisResult;
  horseName?: string;
  shareUrl?: string;
}

function drawCard(canvas: HTMLCanvasElement, result: GaitAnalysisResult, horseName?: string, shareUrl?: string) {
  const ctx = canvas.getContext("2d")!;
  const W = 800, H = 480;
  canvas.width = W;
  canvas.height = H;

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(1, "#16213e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Border accent
  ctx.strokeStyle = "#d4a843";
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  // Title
  ctx.fillStyle = "#d4a843";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🐴 Gait Analysis Report", W / 2, 60);

  // Horse name
  if (horseName) {
    ctx.fillStyle = "#e0e0e0";
    ctx.font = "20px sans-serif";
    ctx.fillText(horseName, W / 2, 95);
  }

  // Scores
  const metrics = [
    { label: "GES (Gait Efficiency)", value: result.overallScore },
    { label: "SI (Symmetry Index)", value: result.symmetry.score },
    { label: "Lateral Sync %", value: result.lateralSync.percentage },
    { label: "Confidence", value: result.confidence },
  ];

  const startY = 140;
  metrics.forEach((m, i) => {
    const y = startY + i * 70;
    const color = m.value >= 80 ? "#22c55e" : m.value >= 60 ? "#eab308" : "#ef4444";

    // Label
    ctx.fillStyle = "#a0a0a0";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(m.label, W / 2 - 30, y + 5);

    // Bar bg
    ctx.fillStyle = "#2a2a4a";
    ctx.fillRect(W / 2, y - 12, 250, 24);

    // Bar fill
    ctx.fillStyle = color;
    ctx.fillRect(W / 2, y - 12, (m.value / 100) * 250, 24);

    // Value
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${m.value}`, W / 2 + 260, y + 6);
  });

  // Gait type badge
  ctx.fillStyle = "#d4a843";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${result.gaitTypeHebrew} — ${result.beatPattern}`, W / 2, H - 80);

  // Watermark
  ctx.fillStyle = "rgba(212, 168, 67, 0.6)";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Analyzed by סוסי צעד — susitsa.app", W / 2, H - 40);

  if (shareUrl) {
    ctx.fillStyle = "rgba(160, 160, 160, 0.5)";
    ctx.font = "11px sans-serif";
    ctx.fillText(shareUrl, W / 2, H - 22);
  }
}

export default function ShareableResultCard({ result, horseName, shareUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);

  const generateImage = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    drawCard(canvas, result, horseName, shareUrl);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      const blob = await generateImage();
      if (!blob) return;
      const file = new File([blob], "gait-analysis.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Gait Analysis — ${horseName || "Report"}`,
          text: `GES: ${result.overallScore} | SI: ${result.symmetry.score} | Lateral Sync: ${result.lateralSync.percentage}%`,
          files: [file],
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "gait-analysis.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("התמונה הורדה בהצלחה");
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        toast.error("שגיאה בשיתוף");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const blob = await generateImage();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gait-${horseName || "report"}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("התמונה הורדה");
  };

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-2">
        <Button onClick={handleShare} variant="default" size="sm" className="gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          שתפו עם Watermark
        </Button>
        <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          הורדה
        </Button>
      </div>
    </div>
  );
}
