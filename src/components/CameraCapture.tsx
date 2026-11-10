import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, StopCircle, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { triggerHaptic } from "@/hooks/useSwipeNavigation";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  maxDurationSec?: number;
}

export default function CameraCapture({ onCapture, onCancel, maxDurationSec = 30 }: CameraCaptureProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch {
      // Camera not available
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setPreview(url);
    };
    mr.start(100);
    mediaRecorderRef.current = mr;
    setRecording(true);
    setElapsed(0);
    triggerHaptic("tap");
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= maxDurationSec) {
          stopRecording();
          return e;
        }
        return e + 1;
      });
    }, 1000);
  }, [stream, maxDurationSec]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
    triggerHaptic("success");
    // Stop all tracks
    stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const acceptRecording = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const file = new File([blob], `capture-${Date.now()}.webm`, { type: "video/webm" });
    onCapture(file);
  }, [onCapture]);

  const retry = useCallback(() => {
    setPreview(null);
    setElapsed(0);
    startCamera();
  }, [startCamera]);

  // Auto start camera on mount
  useEffect(() => { startCamera(); }, [startCamera]);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="relative w-full max-w-lg aspect-video bg-muted rounded-xl overflow-hidden">
        {preview ? (
          <video src={preview} controls className="w-full h-full object-cover" />
        ) : (
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        )}
        {recording && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1 rounded-full text-sm font-medium">
            <div className="h-2 w-2 rounded-full bg-destructive-foreground animate-pulse" />
            {elapsed}s / {maxDurationSec}s
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {preview ? (
          <>
            <Button variant="outline" onClick={retry}>
              <RotateCcw className="h-4 w-4 ml-2" />
              {t("camera.retry")}
            </Button>
            <Button onClick={acceptRecording}>
              <Check className="h-4 w-4 ml-2" />
              {t("camera.accept")}
            </Button>
          </>
        ) : recording ? (
          <Button variant="destructive" onClick={stopRecording} className="min-w-[140px]">
            <StopCircle className="h-4 w-4 ml-2" />
            {t("camera.stop")}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>{t("camera.cancel")}</Button>
            <Button onClick={startRecording} disabled={!stream}>
              <Camera className="h-4 w-4 ml-2" />
              {t("camera.record")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
