import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { breeds } from "@/data/breeds";
import {
  ArrowLeft, ArrowRight, Save, Pencil, X, Activity, Video,
  Calendar, TrendingUp, Dna, Ruler, Clock, Camera, Upload, Trash2, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import {
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { format } from "date-fns";
import HorseProgressAI from "@/components/horse/HorseProgressAI";
import HorseVideoGallery from "@/components/horse/HorseVideoGallery";
import HorseTrendChart from "@/components/horse/HorseTrendChart";
import InjuryPredictionCard from "@/components/horse/InjuryPredictionCard";
import { horseProfileSchema } from "@/lib/validationSchemas";
import PregnancyTracker from "@/components/horse/pregnancy/PregnancyTracker";

interface HorseRow {
  id: string;
  name: string;
  breed_id: string | null;
  dmrt3_genotype: string | null;
  birth_year: number | null;
  sex: string | null;
  height_cm: number | null;
  sire_name: string | null;
  dam_name: string | null;
  sire_dmrt3: string | null;
  dam_dmrt3: string | null;
  notes: string | null;
  photo_url: string | null;
  cover_photo_url: string | null;
  breeding_date: string | null;
  created_at: string;
}

interface GaitRow {
  id: string;
  created_at: string;
  gait_type: string | null;
  overall_score: number | null;
  symmetry_score: number | null;
  confidence: number | null;
  analysis_mode: string | null;
  human_validated: boolean | null;
  horse_name: string | null;
}

interface ConformationRow {
  id: string;
  created_at: string;
  overall_balance: number | null;
  suitability_score: number | null;
  shoulder_angle: number | null;
}

export default function HorseProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang, dir } = useLanguage();
  const { user } = useAuth();

  const [horse, setHorse] = useState<HorseRow | null>(null);
  const [gaitAnalyses, setGaitAnalyses] = useState<GaitRow[]>([]);
  const [conformations, setConformations] = useState<ConformationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<HorseRow>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const BackArrow = lang === "he" ? ArrowRight : ArrowLeft;

  // Fetch horse + analyses
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const [horseRes, gaitRes, confRes] = await Promise.all([
        supabase.from("horses").select("*").eq("id", id).single(),
        supabase
          .from("gait_analyses")
          .select("id, created_at, gait_type, overall_score, symmetry_score, confidence, analysis_mode, human_validated, horse_name")
          .eq("horse_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("conformation_records")
          .select("id, created_at, overall_balance, suitability_score, shoulder_angle")
          .eq("horse_id", id)
          .order("created_at", { ascending: true }),
      ]);
      if (horseRes.data) {
        setHorse(horseRes.data as HorseRow);
        setForm(horseRes.data as HorseRow);
      }
      setGaitAnalyses((gaitRes.data as GaitRow[]) ?? []);
      setConformations((confRes.data as ConformationRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, [id]);

  const breedName = useMemo(() => {
    if (!horse?.breed_id) return null;
    const b = breeds.find((br) => br.id === horse.breed_id);
    return b ? (lang === "he" ? b.nameHe : b.nameEn) : horse.breed_id;
  }, [horse?.breed_id, lang]);

  // Progress chart data
  const scoreChartData = useMemo(
    () =>
      gaitAnalyses
        .filter((g) => g.overall_score != null)
        .map((g) => ({
          date: g.created_at,
          score: g.overall_score,
          symmetry: g.symmetry_score ?? null,
          confidence: g.confidence ?? null,
          gaitType: g.gait_type,
        })),
    [gaitAnalyses]
  );

  const gaitTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    gaitAnalyses.forEach((g) => {
      const type = g.gait_type ?? "unknown";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [gaitAnalyses]);

  // Save edits
  const handleSave = async () => {
    if (!id) return;
    const parsed = horseProfileSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0]?.message ?? t("hp.saveError"), variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("horses")
      .update({
        name: form.name,
        breed_id: form.breed_id,
        dmrt3_genotype: form.dmrt3_genotype,
        birth_year: form.birth_year,
        sex: form.sex,
        height_cm: form.height_cm,
        sire_name: form.sire_name,
        dam_name: form.dam_name,
        sire_dmrt3: form.sire_dmrt3,
        dam_dmrt3: form.dam_dmrt3,
        notes: form.notes,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: t("hp.saveError"), variant: "destructive" });
    } else {
      setHorse({ ...horse!, ...form } as HorseRow);
      setEditing(false);
      toast({ title: t("hp.saveSuccess") });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Max 5MB", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${id}.${ext}`;
    // Remove old photo if exists
    await supabase.storage.from("horse-photos").remove([path]);
    const { error: upErr } = await supabase.storage.from("horse-photos").upload(path, file, { upsert: true });
    if (upErr) {
      toast({ title: t("hp.photo.error"), variant: "destructive" });
      setUploadingPhoto(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("horse-photos").getPublicUrl(path);
    const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("horses").update({ photo_url: photoUrl }).eq("id", id);
    setHorse((prev) => prev ? { ...prev, photo_url: photoUrl } : prev);
    setUploadingPhoto(false);
    toast({ title: t("hp.photo.success") });
  };

  const handleRemovePhoto = async () => {
    if (!user || !id || !horse?.photo_url) return;
    const url = new URL(horse.photo_url.split("?")[0]);
    const pathParts = url.pathname.split("/horse-photos/");
    if (pathParts[1]) {
      await supabase.storage.from("horse-photos").remove([decodeURIComponent(pathParts[1])]);
    }
    await supabase.from("horses").update({ photo_url: null }).eq("id", id);
    setHorse((prev) => prev ? { ...prev, photo_url: null } : prev);
    toast({ title: t("hp.photo.removed") });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Max 5MB", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${id}-cover.${ext}`;
    await supabase.storage.from("horse-photos").remove([path]);
    const { error: upErr } = await supabase.storage.from("horse-photos").upload(path, file, { upsert: true });
    if (upErr) {
      toast({ title: t("hp.photo.error"), variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("horse-photos").getPublicUrl(path);
    const coverUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("horses").update({ cover_photo_url: coverUrl } as any).eq("id", id);
    setHorse((prev) => prev ? { ...prev, cover_photo_url: coverUrl } : prev);
    toast({ title: t("hp.cover.success") ?? "תמונת רקע עודכנה" });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!horse) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">{t("hp.notFound")}</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <BackArrow className="h-4 w-4" />
          {t("hp.backToDashboard")}
        </Button>
      </div>
    );
  }

  const totalAnalyses = gaitAnalyses.length + conformations.length;
  const avgScore =
    gaitAnalyses.length > 0
      ? Math.round(
          gaitAnalyses.reduce((s, g) => s + (g.overall_score ?? 0), 0) /
            gaitAnalyses.filter((g) => g.overall_score != null).length
        )
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6" dir={dir}>
      <Button className="min-h-11 gap-2" onClick={() => navigate(`/gait-analysis?horse=${horse.id}`)}><Video className="h-4 w-4" />{t("dash.gaitAnalysis")}</Button>
      {/* Cover Photo Banner */}
      <div className="relative rounded-xl overflow-hidden group cursor-pointer -mt-4 mb-2" onClick={() => coverInputRef.current?.click()}>
        <div className={`h-36 w-full ${horse.cover_photo_url ? "" : "bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20"}`}>
          {horse.cover_photo_url && (
            <img src={horse.cover_photo_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-sm font-medium text-foreground bg-background/80 px-3 py-1.5 rounded-lg">{t("hp.cover.change") ?? "שנה תמונת רקע"}</span>
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      </div>

      {/* Back + Header */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <BackArrow className="h-5 w-5" />
        </Button>
        {/* Horse Photo */}
        <div className="relative group shrink-0">
          <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
            {horse.photo_url ? (
              <img src={horse.photo_url} alt={horse.name} className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <div className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
            </Button>
            {horse.photo_url && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRemovePhoto}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold break-words">{horse.name}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            {breedName && <Badge variant="secondary">{breedName}</Badge>}
            {horse.dmrt3_genotype && (
              <Badge variant="outline" className="gap-1">
                <Dna className="h-3 w-3" /> {horse.dmrt3_genotype}
              </Badge>
            )}
            {horse.sex && <Badge variant="outline">{t(`hp.sex.${horse.sex}`)}</Badge>}
          </div>
        </div>
        <Button
          variant={editing ? "destructive" : "outline"}
          size="sm"
          onClick={() => {
            if (editing) {
              setForm(horse);
              setEditing(false);
            } else {
              setEditing(true);
            }
          }}
        >
          {editing ? <X className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
          {editing ? t("hp.cancelEdit") : t("hp.editDetails")}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalAnalyses}</p>
            <p className="text-xs text-muted-foreground">{t("hp.totalAnalyses")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{avgScore ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{t("hp.avgScore")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{horse.height_cm ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{t("hp.heightCm")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{horse.birth_year ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{t("hp.birthYear")}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={window.location.hash === "#pregnancy" && horse.sex === "mare" ? "pregnancy" : "ai-insights"} className="w-full">
        <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1">
          {horse.sex === "mare" && <TabsTrigger value="pregnancy" className="min-h-11">{lang === "he" ? "מעקב הריון" : "Pregnancy"}</TabsTrigger>}
          <TabsTrigger value="ai-insights" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {lang === "he" ? "תובנות AI" : "AI insights"}
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1">
            <Video className="h-3 w-3" />
            {lang === "he" ? "סרטונים" : "Videos"}
          </TabsTrigger>
          <TabsTrigger value="timeline">{t("hp.tab.timeline")}</TabsTrigger>
          <TabsTrigger value="progress">{t("hp.tab.progress")}</TabsTrigger>
          <TabsTrigger value="details">{t("hp.tab.details")}</TabsTrigger>
        </TabsList>
        {horse.sex === "mare" && <TabsContent value="pregnancy" className="mt-5"><PregnancyTracker horseId={horse.id} horseName={horse.name} breedingDate={horse.breeding_date}/></TabsContent>}

        {/* ── AI Insights Tab ── */}
        <TabsContent value="ai-insights" className="mt-4 space-y-4">
          <HorseProgressAI
            horseId={id!}
            horseName={horse.name}
            analysisCount={gaitAnalyses.length}
          />
          <InjuryPredictionCard horseId={id!} />
        </TabsContent>

        {/* ── Videos Tab ── */}
        <TabsContent value="videos" className="mt-4">
          <HorseVideoGallery horseId={id!} horseName={horse.name} />
        </TabsContent>

        {/* ── Timeline Tab ── */}
        <TabsContent value="timeline" className="space-y-3 mt-4">
          {totalAnalyses === 0 ? (
            <p className="text-center text-muted-foreground py-10">{t("hp.noAnalyses")}</p>
          ) : (
            <div className="relative border-s-2 border-primary/20 ms-4 space-y-6">
              {[...gaitAnalyses.map((g) => ({ ...g, _type: "gait" as const })),
                ...conformations.map((c) => ({ ...c, _type: "conf" as const })),
              ]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: lang === "he" ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative ps-8"
                  >
                    <span className="absolute start-[-9px] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                    <Card className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item._type === "gait" ? (
                              <Activity className="h-4 w-4 text-primary" />
                            ) : (
                              <Ruler className="h-4 w-4 text-accent-foreground" />
                            )}
                            <span className="font-medium text-sm">
                              {item._type === "gait" ? t("hp.gaitAnalysis") : t("hp.conformationAnalysis")}
                            </span>
                            {item._type === "gait" && (item as GaitRow).gait_type && (
                              <Badge variant="secondary" className="text-xs">
                                {(item as GaitRow).gait_type}
                              </Badge>
                            )}
                            {item._type === "gait" && (item as GaitRow).human_validated && (
                              <Badge className="text-xs bg-green-600">{t("hp.verified")}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                          </div>
                        </div>
                        {item._type === "gait" && (
                          <div className="flex gap-4 mt-2 text-sm">
                            <span>{t("hp.score")}: <strong>{(item as GaitRow).overall_score ?? "—"}</strong></span>
                            <span>{t("hp.symmetry")}: <strong>{(item as GaitRow).symmetry_score ?? "—"}</strong></span>
                          </div>
                        )}
                        {item._type === "conf" && (
                          <div className="flex gap-4 mt-2 text-sm">
                            <span>{t("hp.balance")}: <strong>{(item as ConformationRow).overall_balance ?? "—"}</strong></span>
                            <span>{t("hp.suitability")}: <strong>{(item as ConformationRow).suitability_score ?? "—"}</strong></span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
            </div>
          )}
        </TabsContent>

        {/* ── Progress Tab ── */}
        <TabsContent value="progress" className="space-y-6 mt-4">
          {scoreChartData.length < 2 ? (
            <p className="text-center text-muted-foreground py-10">{t("hp.needMoreData")}</p>
          ) : (
            <>
              <HorseTrendChart data={scoreChartData} />

              {gaitTypeDistribution.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("hp.gaitDistribution")}</CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gaitTypeDistribution}>
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis allowDecimals={false} className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Details / Edit Tab ── */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="p-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("hp.field.name")}</Label>
                {editing ? (
                  <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                ) : (
                  <p className="text-sm">{horse.name}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("hp.field.breed")}</Label>
                {editing ? (
                  <Select value={form.breed_id ?? ""} onValueChange={(v) => setForm({ ...form, breed_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {breeds.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {lang === "he" ? b.nameHe : b.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{breedName ?? "—"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("hp.field.dmrt3")}</Label>
                {editing ? (
                  <Select value={form.dmrt3_genotype ?? ""} onValueChange={(v) => setForm({ ...form, dmrt3_genotype: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">CC</SelectItem>
                      <SelectItem value="CA">CA</SelectItem>
                      <SelectItem value="AA">AA</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{horse.dmrt3_genotype ?? "—"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("hp.field.sex")}</Label>
                {editing ? (
                  <Select value={form.sex ?? ""} onValueChange={(v) => setForm({ ...form, sex: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stallion">{t("hp.sex.stallion")}</SelectItem>
                      <SelectItem value="mare">{t("hp.sex.mare")}</SelectItem>
                      <SelectItem value="gelding">{t("hp.sex.gelding")}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{horse.sex ? t(`hp.sex.${horse.sex}`) : "—"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("hp.field.birthYear")}</Label>
                {editing ? (
                  <Input type="number" value={form.birth_year ?? ""} onChange={(e) => setForm({ ...form, birth_year: e.target.value ? Number(e.target.value) : null })} />
                ) : (
                  <p className="text-sm">{horse.birth_year ?? "—"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("hp.field.height")}</Label>
                {editing ? (
                  <Input type="number" value={form.height_cm ?? ""} onChange={(e) => setForm({ ...form, height_cm: e.target.value ? Number(e.target.value) : null })} />
                ) : (
                  <p className="text-sm">{horse.height_cm ? `${horse.height_cm} cm` : "—"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("hp.field.sire")}</Label>
                {editing ? (
                  <Input value={form.sire_name ?? ""} onChange={(e) => setForm({ ...form, sire_name: e.target.value })} />
                ) : (
                  <p className="text-sm">{horse.sire_name ?? "—"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("hp.field.dam")}</Label>
                {editing ? (
                  <Input value={form.dam_name ?? ""} onChange={(e) => setForm({ ...form, dam_name: e.target.value })} />
                ) : (
                  <p className="text-sm">{horse.dam_name ?? "—"}</p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label>{t("hp.field.notes")}</Label>
                {editing ? (
                  <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{horse.notes ?? "—"}</p>
                )}
              </div>
              {editing && (
                <div className="sm:col-span-2">
                  <Button onClick={handleSave} disabled={saving || !form.name} className="w-full">
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? t("hp.saving") : t("hp.save")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
