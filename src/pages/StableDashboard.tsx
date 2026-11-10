import { useState, useMemo, useRef } from "react";
import SmartHighlights from "@/components/dashboard/SmartHighlights";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Plus, AlertTriangle, TrendingDown, TrendingUp, Activity, Users,
  Dumbbell, Brain, RefreshCw, Loader2, Video, ScanEye, ChevronLeft,
  Calendar as CalendarIcon, Trash2, Camera, Heart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfWeek, formatDistanceToNow } from "date-fns";
import { he, enUS } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { breeds } from "@/data/breeds";
import { useLanguage } from "@/contexts/LanguageContext";
import GDPRExport from "@/components/GDPRExport";
import ReferralCard from "@/components/ReferralCard";
import { cn } from "@/lib/utils";

// ── Types ──
interface HorseRow {
  id: string;
  name: string;
  breed_id: string | null;
  dmrt3_genotype: string | null;
  birth_year: number | null;
  sex: string | null;
  notes: string | null;
  created_at: string;
  cover_photo_url: string | null;
  photo_url: string | null;
  breeding_date: string | null;
}

interface GaitRow {
  id: string;
  horse_id: string | null;
  horse_name: string | null;
  overall_score: number | null;
  symmetry_score: number | null;
  gait_type: string | null;
  gait_type_hebrew: string | null;
  is_dirty: boolean | null;
  lameness_risk: string | null;
  analysis_mode: string | null;
  created_at: string;
}

interface ConformationRow {
  id: string;
  horse_id: string | null;
  suitability_score: number | null;
  overall_balance: number | null;
  recommendation: string | null;
  created_at: string;
}

interface HorseWithHistory extends HorseRow {
  gaitAnalyses: GaitRow[];
  conformationRecords: ConformationRow[];
  latestScore: number | null;
  trend: "up" | "down" | "stable" | "none";
}

// ── Helpers ──
function detectTrend(scores: number[]): "up" | "down" | "stable" | "none" {
  if (scores.length < 3) return "none";
  const last3 = scores.slice(-3);
  if (last3[0] > last3[1] && last3[1] > last3[2]) return "down";
  if (last3[0] < last3[1] && last3[1] < last3[2]) return "up";
  return "stable";
}

// ── Add Horse Form ──
function AddHorseDialog({ onAdded }: { onAdded: () => void }) {
  const { t, lang } = useLanguage();
  const dateFnsLocale = lang === "he" ? he : enUS;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [breedId, setBreedId] = useState("");
  const [sex, setSex] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [dmrt3, setDmrt3] = useState("");
  const [notes, setNotes] = useState("");
  const [breedingDate, setBreedingDate] = useState<Date | undefined>();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Max 5MB", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t("dash.nameRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);

    let photoUrl: string | null = null;
    if (photoFile && user) {
      const ext = photoFile.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("horse-photos").upload(path, photoFile);
      if (uploadErr) {
        toast({ title: t("dash.saveError"), description: uploadErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("horse-photos").getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("horses").insert({
      name: name.trim(),
      breed_id: breedId || null,
      sex: sex || null,
      birth_year: birthYear ? parseInt(birthYear) : null,
      dmrt3_genotype: dmrt3 || null,
      notes: notes || null,
      user_id: user?.id,
      breeding_date: breedingDate ? format(breedingDate, "yyyy-MM-dd") : null,
      photo_url: photoUrl,
    });
    setSaving(false);
    if (error) {
      toast({ title: t("dash.saveError"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${name} ${t("dash.addedSuccess")}` });
      setName(""); setBreedId(""); setSex(""); setBirthYear(""); setDmrt3(""); setNotes("");
      setBreedingDate(undefined); setPhotoFile(null); setPhotoPreview(null);
      setOpen(false);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 min-h-[48px] shadow-lg shadow-primary/20">
          <Plus className="h-5 w-5" />
          {t("dash.addHorse")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-rubik text-xl">{t("dash.addHorseTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Profile Photo */}
          <div className="flex items-center gap-4">
            <div
              className="relative h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label>{t("dash.profilePhoto")}</Label>
              <Button variant="outline" size="sm" className="mt-1" onClick={() => fileInputRef.current?.click()}>
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                {t("dash.uploadPhoto")}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </div>
          </div>

          <div>
            <Label htmlFor="horse-name">{t("dash.horseName")}</Label>
            <Input id="horse-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("dash.horseNamePlaceholder")} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("dash.breed")}</Label>
              <Select value={breedId} onValueChange={setBreedId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("dash.breedPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standardbred">Standardbred</SelectItem>
                  <SelectItem value="trotter">Trotter</SelectItem>
                  <SelectItem value="pacer">Pacer</SelectItem>
                  <SelectItem value="racking">Racking / Singlefoot</SelectItem>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("dash.sex")}</Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("dash.sexPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stallion">{t("dash.sexStallion")}</SelectItem>
                  <SelectItem value="mare">{t("dash.sexMare")}</SelectItem>
                  <SelectItem value="gelding">{t("dash.sexGelding")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="birth-year">{t("dash.birthYear")}</Label>
              <Input id="birth-year" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="2018" className="mt-1" />
            </div>
            <div>
              <Label>{t("dash.dmrt3Genotype")}</Label>
              <Select value={dmrt3} onValueChange={setDmrt3}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("dash.dmrt3Unknown")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AA">AA</SelectItem>
                  <SelectItem value="CA">CA</SelectItem>
                  <SelectItem value="CC">CC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Breeding Date */}
          <div>
            <Label>{t("dash.breedingDate")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !breedingDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {breedingDate ? format(breedingDate, "PPP", { locale: dateFnsLocale }) : t("dash.breedingDatePlaceholder")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={breedingDate}
                  onSelect={setBreedingDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="horse-notes">{t("dash.notes")}</Label>
            <Textarea id="horse-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("dash.notesPlaceholder")} className="mt-1" rows={2} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full min-h-[48px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Plus className="h-4 w-4 ml-2" />}
            {t("dash.saveHorse")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Horse Card ──
function HorseCard({ horse, onDelete }: { horse: HorseWithHistory; onDelete: (id: string) => void }) {
  const { t, lang } = useLanguage();
  const dateFnsLocale = lang === "he" ? he : enUS;

  const TREND_ICONS: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    up: { icon: <TrendingUp className="h-4 w-4" />, color: "text-green-500", label: t("dash.trendUp") },
    down: { icon: <TrendingDown className="h-4 w-4" />, color: "text-red-500", label: t("dash.trendDown") },
    stable: { icon: <Activity className="h-4 w-4" />, color: "text-amber-500", label: t("dash.trendStable") },
    none: { icon: <Activity className="h-4 w-4" />, color: "text-muted-foreground", label: t("dash.trendNone") },
  };

  const MODE_LABELS: Record<string, string> = {
    vision: t("dash.modeVision"),
    audio: t("dash.modeAudio"),
    both: t("dash.modeBoth"),
  };

  const trend = TREND_ICONS[horse.trend];
  const latestGait = horse.gaitAnalyses[0];
  const latestConf = horse.conformationRecords[0];
  const totalAnalyses = horse.gaitAnalyses.length + horse.conformationRecords.length;

  const sexLabel = horse.sex === "stallion" ? t("dash.sexStallionShort") : horse.sex === "mare" ? t("dash.sexMareShort") : t("dash.sexGeldingShort");

  const coverUrl = horse.cover_photo_url || horse.photo_url;
  const horseAge = horse.birth_year ? new Date().getFullYear() - horse.birth_year : null;

  return (
    <Card className="glass-card hover:border-primary/30 transition-all duration-300 overflow-hidden">
      {coverUrl && (
        <div className="h-28 w-full overflow-hidden relative">
          <img src={coverUrl} alt={horse.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {horse.photo_url && !coverUrl?.includes(horse.photo_url || "") && (
              <img src={horse.photo_url} alt={horse.name} className="h-10 w-10 rounded-full object-cover border border-border" />
            )}
            <div>
              <CardTitle className="text-lg font-rubik flex items-center gap-2">
                <a href={`/horse/${horse.id}`} className="hover:text-primary transition-colors hover:underline">
                  {horse.name}
                </a>
                {horse.dmrt3_genotype && (
                  <Badge variant="outline" className="text-xs">{horse.dmrt3_genotype}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                {horse.breed_id && <span>{horse.breed_id}</span>}
                {horse.sex && <span>• {sexLabel}</span>}
                {horse.sex === "mare" && <Button asChild variant="outline" size="sm" className="min-h-11 gap-1"><a href={`/horse/${horse.id}#pregnancy`}><Heart className="h-4 w-4"/>{lang === "he" ? "מעקב הריון" : "Pregnancy tracking"}</a></Button>}
                {horseAge !== null && <span>• {t("dash.age")}: {horseAge} {t("dash.yearsOld")}</span>}
                {horse.breeding_date && (
                  <span className="flex items-center gap-0.5">
                    • <Heart className="h-3 w-3 text-pink-500" />
                    {t("dash.breedingIn")}: {format(new Date(horse.breeding_date), "dd/MM/yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {horse.latestScore !== null && (
              <div className="flex items-center gap-1">
                <span className={`text-2xl font-bold ${horse.latestScore >= 80 ? "text-green-500" : horse.latestScore >= 60 ? "text-amber-500" : "text-red-500"}`}>
                  {horse.latestScore}
                </span>
                <span className={trend.color}>{trend.icon}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Video className="h-3 w-3" />
              {t("dash.gaitAnalysis")}
            </div>
            {latestGait ? (
              <div>
                <span className="text-sm font-medium">{(lang === "he" ? latestGait.gait_type_hebrew : latestGait.gait_type) || "—"}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {latestGait.overall_score && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">{latestGait.overall_score}/100</Badge>
                  )}
                  {latestGait.analysis_mode && (
                    <Badge variant="outline" className="text-[10px] px-1.5">{MODE_LABELS[latestGait.analysis_mode] || latestGait.analysis_mode}</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(latestGait.created_at), { addSuffix: true, locale: dateFnsLocale })}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("dash.noYet")}</p>
            )}
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <ScanEye className="h-3 w-3" />
              {t("dash.conformation")}
            </div>
            {latestConf ? (
              <div>
                <span className="text-sm font-medium">
                  {latestConf.suitability_score !== null ? `${latestConf.suitability_score}/100` : "—"}
                </span>
                {latestConf.overall_balance !== null && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 mr-1">{latestConf.overall_balance}</Badge>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(latestConf.created_at), { addSuffix: true, locale: dateFnsLocale })}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("dash.noYet")}</p>
            )}
          </div>
        </div>

        {totalAnalyses > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {horse.gaitAnalyses.length} {t("dash.gaitAnalysisCount")} · {horse.conformationRecords.length} {t("dash.conformationCount")}
          </div>
        )}

        {horse.gaitAnalyses.length > 1 && (
          <div className="border-t border-border pt-2">
            <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">{t("dash.recentHistory")}</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {horse.gaitAnalyses.slice(0, 5).map((g) => (
                <div key={g.id} className="flex items-center justify-between text-[11px] bg-card/60 rounded px-2 py-1">
                  <span>{(lang === "he" ? g.gait_type_hebrew : g.gait_type) || "—"}</span>
                  <div className="flex items-center gap-2">
                    {g.overall_score && <span className="font-medium">{g.overall_score}</span>}
                    <span className="text-muted-foreground">{format(new Date(g.created_at), "dd/MM/yy")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button asChild size="sm" className="flex-1 min-h-[44px] gap-1.5">
            <Link to={`/gait-analysis?horse=${horse.id}`}>
              <Video className="h-3.5 w-3.5" />
              {t("dash.gaitAnalysis")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1 min-h-[44px] gap-1.5">
            <Link to="/conformation">
              <ScanEye className="h-3.5 w-3.5" />
              {t("dash.conformation")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(horse.id)}
            aria-label={`Delete ${horse.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ──
export default function StableDashboard() {
  const { t, dir, lang } = useLanguage();
  const dateFnsLocale = lang === "he" ? he : enUS;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedHorse, setSelectedHorse] = useState<string>("all");
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // ── Data Queries ──
  const { data: horses = [], isLoading: loadingHorses } = useQuery({
    queryKey: ["dashboard-horses"],
    queryFn: async () => {
      const { data } = await supabase.from("horses").select("*").order("name");
      return (data || []) as HorseRow[];
    },
  });

  const { data: gaitAnalyses = [], isLoading: loadingGait } = useQuery({
    queryKey: ["dashboard-gait"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gait_analyses")
        .select("id, horse_id, horse_name, overall_score, symmetry_score, gait_type, gait_type_hebrew, is_dirty, lameness_risk, analysis_mode, created_at")
        .order("created_at", { ascending: false });
      return (data || []) as GaitRow[];
    },
  });

  const { data: conformationRecords = [] } = useQuery({
    queryKey: ["dashboard-conformation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conformation_records")
        .select("id, horse_id, suitability_score, overall_balance, recommendation, created_at")
        .order("created_at", { ascending: false });
      return (data || []) as ConformationRow[];
    },
  });

  const { data: trainingLogs = [] } = useQuery({
    queryKey: ["dashboard-training"],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("training_logs")
        .select("horse_id, date")
        .gte("date", sevenDaysAgo.split("T")[0]);
      return data || [];
    },
  });

  const isLoading = loadingHorses || loadingGait;

  const horsesWithHistory = useMemo<HorseWithHistory[]>(() => {
    return horses.map((h) => {
      const gait = gaitAnalyses.filter((g) => g.horse_id === h.id);
      const conf = conformationRecords.filter((c) => c.horse_id === h.id);
      const scores = gait
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((a) => a.overall_score)
        .filter(Boolean) as number[];
      return {
        ...h,
        gaitAnalyses: gait,
        conformationRecords: conf,
        latestScore: gait[0]?.overall_score ?? null,
        trend: detectTrend(scores),
      };
    });
  }, [horses, gaitAnalyses, conformationRecords]);

  const totalHorses = horses.length;
  const avgScore = useMemo(() => {
    const scores = horsesWithHistory.map((h) => h.latestScore).filter(Boolean) as number[];
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }, [horsesWithHistory]);
  const totalAnalyses = gaitAnalyses.length + conformationRecords.length;
  const weeklyTrainings = trainingLogs.length;

  const handleDelete = async (id: string) => {
    const horse = horses.find((h) => h.id === id);
    if (!confirm(t("dash.deleteConfirm").replace("{name}", horse?.name || ""))) return;
    const { error } = await supabase.from("horses").delete().eq("id", id);
    if (error) {
      toast({ title: t("dash.deleteError"), variant: "destructive" });
    } else {
      toast({ title: `${horse?.name} ${t("dash.deleted")}` });
      queryClient.invalidateQueries({ queryKey: ["dashboard-horses"] });
    }
  };

  const handleHorseAdded = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-horses"] });
  };

  const chartData = useMemo(() => {
    const filtered = selectedHorse === "all"
      ? gaitAnalyses
      : gaitAnalyses.filter((g) => g.horse_id === selectedHorse);

    const weekMap = new Map<string, { scores: number[]; symmetry: number[] }>();
    filtered.forEach((g) => {
      const week = format(startOfWeek(new Date(g.created_at), { weekStartsOn: 0 }), "dd/MM", { locale: dateFnsLocale });
      if (!weekMap.has(week)) weekMap.set(week, { scores: [], symmetry: [] });
      const w = weekMap.get(week)!;
      if (g.overall_score) w.scores.push(g.overall_score);
      if (g.symmetry_score) w.symmetry.push(g.symmetry_score);
    });

    return Array.from(weekMap.entries()).map(([week, v]) => ({
      week,
      overallScore: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : null,
      symmetryScore: v.symmetry.length ? Math.round(v.symmetry.reduce((a, b) => a + b, 0) / v.symmetry.length) : null,
    }));
  }, [gaitAnalyses, selectedHorse, dateFnsLocale]);

  const fetchAIInsights = async () => {
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("stable-analytics", {
        body: { horses: horsesWithHistory.map(h => ({ id: h.id, name: h.name, latestScore: h.latestScore, trend: h.trend, dmrt3_genotype: h.dmrt3_genotype })), trainingCount: weeklyTrainings },
      });
      if (error) throw error;
      setAiInsights(data);
    } catch {
      toast({ title: t("conf.error"), description: t("dash.aiError"), variant: "destructive" });
    } finally {
      setLoadingAI(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8 space-y-6" dir={dir}>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-rubik font-bold text-gradient-gold">{t("dash.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("dash.subtitle")}</p>
        </div>
        <AddHorseDialog onAdded={handleHorseAdded} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6 text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold">{totalHorses}</p>
            <p className="text-sm text-muted-foreground">{t("dash.kpiHorses")}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6 text-center">
            <Activity className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold">{avgScore}<span className="text-lg text-muted-foreground">/100</span></p>
            <p className="text-sm text-muted-foreground">{t("dash.kpiAvgScore")}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6 text-center">
            <Video className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold">{totalAnalyses}</p>
            <p className="text-sm text-muted-foreground">{t("dash.kpiAnalyses")}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6 text-center">
            <Dumbbell className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold">{weeklyTrainings}</p>
            <p className="text-sm text-muted-foreground">{t("dash.kpiWeeklyTrainings")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Smart Highlights */}
      <SmartHighlights
        gaitAnalyses={gaitAnalyses.map(g => ({ id: g.id, horse_id: g.horse_id, horse_name: g.horse_name, overall_score: g.overall_score, created_at: g.created_at }))}
        totalHorses={totalHorses}
        weeklyTrainings={weeklyTrainings}
      />

      {/* Horse Cards */}
      {horses.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <div className="text-6xl mb-4">🐴</div>
            <h2 className="text-xl font-rubik font-bold mb-2">{t("dash.noHorses")}</h2>
            <p className="text-muted-foreground mb-6">{t("dash.noHorsesDesc")}</p>
            <AddHorseDialog onAdded={handleHorseAdded} />
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-xl font-rubik font-bold mb-4 flex items-center gap-2">
            {t("dash.myHorses")}
            <Badge variant="secondary">{totalHorses}</Badge>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {horsesWithHistory.map((horse) => (
              <HorseCard key={horse.id} horse={horse} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-rubik">{t("dash.performanceTrend")}</CardTitle>
          <Select value={selectedHorse} onValueChange={setSelectedHorse}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("dash.allHorses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dash.allHorses")}</SelectItem>
              {horses.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">{t("dash.noPerformanceData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={14} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={14} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="overallScore" name={t("dash.overallScore")} stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="symmetryScore" name={t("dash.symmetry")} stroke="hsl(200, 80%, 60%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-rubik">{t("dash.aiInsights")}</CardTitle>
          <Button variant="outline" onClick={fetchAIInsights} disabled={loadingAI || horses.length === 0} className="min-h-[44px]">
            {loadingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="mr-1">{t("dash.refresh")}</span>
          </Button>
        </CardHeader>
        <CardContent>
          {!aiInsights ? (
            <p className="text-center text-muted-foreground py-8">
              {horses.length === 0 ? t("dash.aiNoHorses") : t("dash.aiClickRefresh")}
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-foreground">{aiInsights.summary}</p>
              {aiInsights.recommendations?.length > 0 && (
                <div>
                  <p className="font-medium text-primary mb-1">{t("dash.aiRecommendations")}</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {aiInsights.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Privacy & Referral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReferralCard />
        <GDPRExport />
      </div>
    </div>
  );
}
