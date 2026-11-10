import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX, Music, Upload, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const BUCKET = "hero-music";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB - high bitrate audio
const DEFAULT_VOLUME = 0.15;

interface MusicFile {
  name: string;
  url: string;
}

const BackgroundMusicPlayer = () => {
  const { isAdmin } = useAdminAccess();
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [tracks, setTracks] = useState<MusicFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list(undefined, {
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;

      const files: MusicFile[] = (data || [])
        .filter((f) => !f.name.startsWith("."))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
        }));

      setTracks(files);
      if (files.length > 0 && !musicUrl) {
        setMusicUrl(files[0].url);
      }
      if (files.length === 0) {
        setMusicUrl(null);
      }
    } catch {
      toast.error("שגיאה בטעינת רשימת שירים");
    } finally {
      setLoading(false);
    }
  }, [musicUrl]);

  // Load tracks on mount
  useEffect(() => {
    loadTracks();
  }, []);

  // Sync volume/muted
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  // Auto-play when musicUrl changes
  useEffect(() => {
    if (audioRef.current && musicUrl) {
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    }
  }, [musicUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const valid = Array.from(files).filter((file) => {
      if (!file.type.startsWith("audio/")) {
        toast.error(`${file.name}: יש להעלות קובץ אודיו בלבד`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: גודל מקסימלי 100MB`);
        return false;
      }
      return true;
    });

    if (valid.length === 0) return;

    setUploading(true);
    try {
      for (const file of valid) {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { upsert: false });
        if (error) throw error;
      }
      toast.success("השיר הועלה בהצלחה!");
      await loadTracks();
    } catch (err: any) {
      toast.error("שגיאה בהעלאה: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([name]);
      if (error) throw error;
      toast.success("השיר נמחק");
      await loadTracks();
    } catch (err: any) {
      toast.error("שגיאה במחיקה: " + err.message);
    }
  };

  const toggleMute = () => setMuted((m) => !m);

  return (
    <>
      {/* Hidden audio element */}
      {musicUrl && (
        <audio ref={audioRef} loop muted={muted} autoPlay preload="auto">
          <source src={musicUrl} />
        </audio>
      )}

      {/* Floating mute/unmute button */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleMute}
        className="fixed bottom-4 right-4 z-50 bg-background/80 backdrop-blur-sm h-10 w-10"
        title={muted ? "הפעל מוזיקת רקע" : "השתק מוזיקת רקע"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>

      {/* Music management button */}
      {isAdmin && !showPanel && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowPanel(true);
            loadTracks();
          }}
          className="fixed bottom-4 right-16 z-50 bg-background/80 backdrop-blur-sm"
        >
          <Music className="h-4 w-4 ml-2" />
          ניהול מוזיקה
        </Button>
      )}

      {/* Management panel */}
      {isAdmin && showPanel && (
        <div className="fixed bottom-16 right-4 z-50 glass-card p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">מוזיקת רקע</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-2 mb-3">
            <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
            <Slider
              value={[volume * 100]}
              onValueChange={([v]) => setVolume(v / 100)}
              max={100}
              step={1}
              className="flex-1"
            />
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tracks.length > 0 ? (
            <ScrollArea className="h-32 mb-3">
              <div className="space-y-2 pr-2">
                {tracks.map((track, i) => (
                  <div
                    key={track.name}
                    className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer transition-colors ${
                      musicUrl === track.url ? "bg-primary/20 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                    }`}
                    onClick={() => setMusicUrl(track.url)}
                  >
                    <Music className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-foreground">שיר {i + 1}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(track.name);
                      }}
                      className="text-destructive hover:text-destructive/80 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">אין שירים. העלו קובץ MP3 או WAV.</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/ogg,audio/mp3,audio/flac,audio/x-flac,audio/aac,audio/mp4,audio/x-m4a"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full" size="sm">
            <Upload className="h-4 w-4 ml-2" />
            {uploading ? "מעלה..." : "הוספת שיר"}
          </Button>
        </div>
      )}
    </>
  );
};

export default BackgroundMusicPlayer;
