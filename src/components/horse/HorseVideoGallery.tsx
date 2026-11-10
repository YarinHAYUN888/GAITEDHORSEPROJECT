import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Video, Upload, Trash2, Loader2, Play, Film, Link2 } from "lucide-react";
import { format } from "date-fns";

interface HorseVideo {
  id: string;
  horse_id: string;
  analysis_id: string | null;
  file_url: string;
  file_path: string;
  file_size_bytes: number | null;
  label: string | null;
  created_at: string;
}

interface Props {
  horseId: string;
  horseName: string;
}

export default function HorseVideoGallery({ horseId, horseName }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [videos, setVideos] = useState<HorseVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVideos();
  }, [horseId]);

  const loadVideos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("horse_videos" as any)
      .select("*")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setVideos(data as any as HorseVideo[]);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("video/")) {
      toast({ title: "יש להעלות קובץ וידאו בלבד", variant: "destructive" });
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      toast({ title: "גודל מקסימלי: 200MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `${user.id}/${horseId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("horse-videos")
      .upload(path, file, { upsert: false });

    if (upErr) {
      toast({ title: "שגיאה בהעלאה", description: upErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("horse-videos").getPublicUrl(path);

    const { error: insertErr } = await supabase
      .from("horse_videos" as any)
      .insert({
        horse_id: horseId,
        file_path: path,
        file_url: urlData.publicUrl,
        file_size_bytes: file.size,
        label: file.name.replace(/\.[^.]+$/, ""),
      } as any);

    if (insertErr) {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } else {
      toast({ title: "הסרטון הועלה בהצלחה" });
      loadVideos();
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (video: HorseVideo) => {
    await supabase.storage.from("horse-videos").remove([video.file_path]);
    await supabase.from("horse_videos" as any).delete().eq("id", video.id);
    setVideos((prev) => prev.filter((v) => v.id !== video.id));
    toast({ title: "הסרטון נמחק" });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            סרטונים
            <Badge variant="secondary" className="text-xs">{videos.length}</Badge>
          </CardTitle>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-1"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              העלה סרטון
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground space-y-2">
            <Video className="h-10 w-10 mx-auto opacity-40" />
            <p className="text-sm">עדיין לא הועלו סרטונים עבור {horseName}</p>
            <p className="text-xs">העלו סרטוני תנועה כדי לעקוב אחרי ההתקדמות</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((video) => (
              <div
                key={video.id}
                className="relative rounded-lg border border-border overflow-hidden bg-muted/30"
              >
                {playingId === video.id ? (
                  <video
                    src={video.file_url}
                    controls
                    autoPlay
                    className="w-full aspect-video object-cover"
                    onEnded={() => setPlayingId(null)}
                  />
                ) : (
                  <button
                    onClick={() => setPlayingId(video.id)}
                    className="w-full aspect-video bg-background/50 flex items-center justify-center group cursor-pointer hover:bg-background/70 transition-colors"
                  >
                    <Play className="h-10 w-10 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                <div className="p-2 flex items-center justify-between">
                  <div className="text-xs space-y-0.5 min-w-0">
                    <p className="font-medium truncate">{video.label || "סרטון"}</p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{format(new Date(video.created_at), "dd/MM/yy")}</span>
                      {video.file_size_bytes && <span>{formatSize(video.file_size_bytes)}</span>}
                      {video.analysis_id && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 h-4">
                          <Link2 className="h-2.5 w-2.5" />
                          ניתוח
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(video)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
