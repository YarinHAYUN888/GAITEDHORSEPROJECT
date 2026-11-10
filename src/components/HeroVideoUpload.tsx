import { useState, useRef, useEffect } from "react";
import { Upload, X, Video, Trash2, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HeroVideoUploadProps {
  onVideosChanged: (urls: string[]) => void;
}

interface VideoFile {
  name: string;
  url: string;
  size: number;
}

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const HeroVideoUpload = ({ onVideosChanged }: HeroVideoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from("hero-videos").list(undefined, {
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;

      const videoFiles: VideoFile[] = (data || [])
        .filter((f) => !f.name.startsWith("."))
        .map((f) => {
          const { data: urlData } = supabase.storage.from("hero-videos").getPublicUrl(f.name);
          return { name: f.name, url: urlData.publicUrl, size: f.metadata?.size || 0 };
        });

      setVideos(videoFiles);
      onVideosChanged(videoFiles.map((v) => v.url));
    } catch (err: any) {
      toast.error("שגיאה בטעינת רשימת סרטונים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showPanel) loadVideos();
  }, [showPanel]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((file) => {
      if (!file.type.startsWith("video/")) {
        toast.error(`${file.name}: יש להעלות קובץ וידאו בלבד`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: הקובץ גדול מדי (מקסימום 200MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of validFiles) {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await supabase.storage
          .from("hero-videos")
          .upload(fileName, file, { upsert: false });

        if (error) throw error;
      }

      sessionStorage.removeItem("hero-video-urls");
      toast.success(`${validFiles.length} סרטונים הועלו בהצלחה!`);
      await loadVideos();
    } catch (err: any) {
      toast.error("שגיאה בהעלאה: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const { error } = await supabase.storage.from("hero-videos").remove([name]);
      if (error) throw error;
      sessionStorage.removeItem("hero-video-urls");
      toast.success("הסרטון נמחק");
      await loadVideos();
    } catch (err: any) {
      toast.error("שגיאה במחיקה: " + err.message);
    }
  };

  const moveVideo = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= videos.length) return;

    // Rename files to swap order (prefix with new timestamps)
    const a = videos[index];
    const b = videos[newIndex];

    try {
      // Download both files
      const [resA, resB] = await Promise.all([
        supabase.storage.from("hero-videos").download(a.name),
        supabase.storage.from("hero-videos").download(b.name),
      ]);
      if (resA.error || resB.error) throw resA.error || resB.error;

      // Delete both
      await supabase.storage.from("hero-videos").remove([a.name, b.name]);

      // Re-upload with swapped names
      await Promise.all([
        supabase.storage.from("hero-videos").upload(b.name, resA.data!, { upsert: true }),
        supabase.storage.from("hero-videos").upload(a.name, resB.data!, { upsert: true }),
      ]);

      sessionStorage.removeItem("hero-video-urls");
      await loadVideos();
    } catch (err: any) {
      toast.error("שגיאה בשינוי סדר");
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!showPanel) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPanel(true)}
        className="fixed bottom-4 left-4 z-50 bg-background/80 backdrop-blur-sm"
      >
        <Video className="h-4 w-4 ml-2" />
        ניהול סרטוני רקע
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 glass-card p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">ניהול סרטוני רקע</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPanel(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : videos.length > 0 ? (
        <ScrollArea className="h-48 mb-3">
          <div className="space-y-2 pr-2">
            {videos.map((video, i) => (
              <div key={video.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveVideo(i, "up")}
                    disabled={i === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveVideo(i, "down")}
                    disabled={i === videos.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0 truncate">
                  <span className="text-foreground">סרטון {i + 1}</span>
                  {video.size > 0 && (
                    <span className="text-muted-foreground mr-1">({formatSize(video.size)})</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(video.name)}
                  className="text-destructive hover:text-destructive/80 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">אין סרטונים. העלו סרטונים שיוצגו ברקע דף הבית.</p>
      )}

      <p className="text-xs text-muted-foreground mb-2">
        MP4/WebM עד 200MB · הסרטונים ירוצו ברצף אוטומטי
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full"
        size="sm"
      >
        <Upload className="h-4 w-4 ml-2" />
        {uploading ? "מעלה..." : "הוספת סרטונים"}
      </Button>
    </div>
  );
};

export default HeroVideoUpload;
