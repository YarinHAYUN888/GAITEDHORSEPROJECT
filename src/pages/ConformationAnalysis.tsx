import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Camera, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ConformationResults, { ConformationResult, computeSuitabilityScore } from "@/components/conformation/ConformationResults";
import ConformationHistory from "@/components/conformation/ConformationHistory";
import { useHorses } from "@/hooks/useHorses";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ConformationAnalysis() {
  const { t, dir } = useLanguage();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [horseName, setHorseName] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [breedId, setBreedId] = useState("");
  const [dmrt3Genotype, setDmrt3Genotype] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ConformationResult | null>(null);
  const [suitabilityScore, setSuitabilityScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { horses } = useHorses();

  const handleHorseSelect = (horseId: string) => {
    if (horseId === "__manual__") {
      setSelectedHorseId(null);
      setHorseName("");
      setBreedId("");
      setDmrt3Genotype("");
      return;
    }
    const horse = horses.find((h) => h.id === horseId);
    if (horse) {
      setSelectedHorseId(horse.id);
      setHorseName(horse.name);
      setBreedId(horse.breed_id || "");
      setDmrt3Genotype(horse.dmrt3_genotype || "");
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: t("conf.error"), description: t("conf.errorImageOnly"), variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("conf.error"), description: t("conf.errorTooLarge"), variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const saveRecord = async (analysis: ConformationResult, score: number) => {
    try {
      await (supabase.from("conformation_records" as any) as any).insert({
        horse_id: selectedHorseId || null,
        horse_name: horseName || null,
        breed_id: breedId || null,
        dmrt3_genotype: dmrt3Genotype || null,
        shoulder_angle: analysis.shoulderAngle,
        back_ratio: analysis.backRatio,
        croup_slope: analysis.croupSlope,
        hind_leg_angles: analysis.hindLegAngles,
        neck_set: analysis.neckSet,
        overall_balance: analysis.overallBalance,
        suitability_score: score,
        gait_suitability: analysis.gaitSuitability,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        injury_risk_areas: analysis.injuryRiskAreas || [],
        recommendation: analysis.recommendation,
        result_json: analysis,
      });
      setHistoryRefresh((p) => p + 1);
    } catch (err) {
      console.error("Failed to save conformation record", err);
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("conformation-analysis", {
        body: { imageBase64, horseName, breedId, dmrt3Genotype },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (!data?.analysis) throw new Error(t("conf.errorNoResults"));

      const analysis: ConformationResult = data.analysis;
      const score = computeSuitabilityScore(analysis);
      setResult(analysis);
      setSuitabilityScore(score);
      toast({ title: t("conf.successTitle"), description: t("conf.successDesc") });

      await saveRecord(analysis, score);
    } catch (err: any) {
      const msg = err?.message || t("conf.errorDefault");
      setError(msg);
      toast({ title: t("conf.error"), description: msg, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewHistoryRecord = (r: ConformationResult, score: number) => {
    setResult(r);
    setSuitabilityScore(score);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="container py-8 max-w-4xl" dir={dir}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-rubik font-bold text-gradient-gold mb-2">{t("conf.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("conf.subtitle")}</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("conf.profileImage")}</CardTitle>
            <CardDescription>{t("conf.profileImageDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            {imagePreview ? (
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <img src={imagePreview} alt="Horse profile" className="w-full rounded-lg border border-border object-cover max-h-80" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Camera className="h-8 w-8 text-white" />
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.files?.[0] && handleFileSelect(e.dataTransfer.files[0]); }}
                className="border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("conf.dropOrClick")}</p>
                <p className="text-xs text-muted-foreground">{t("conf.imageFormats")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("conf.horseDetails")}</CardTitle>
            <CardDescription>{t("conf.horseDetailsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {horses.length > 0 && (
              <div>
                <Label>{t("conf.selectHorse")}</Label>
                <Select onValueChange={handleHorseSelect} value={selectedHorseId || "__manual__"}>
                  <SelectTrigger><SelectValue placeholder={t("conf.selectHorsePlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">{t("conf.manualEntry")}</SelectItem>
                    {horses.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t("conf.horseName")}</Label>
              <Input value={horseName} onChange={(e) => setHorseName(e.target.value)} placeholder={t("conf.horseNamePlaceholder")} disabled={!!selectedHorseId} />
            </div>
            <div>
              <Label>{t("conf.breed")}</Label>
              <Select value={breedId} onValueChange={setBreedId} disabled={!!selectedHorseId}>
                <SelectTrigger><SelectValue placeholder={t("conf.breedPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="icelandic">{t("conf.breedIcelandic")}</SelectItem>
                  <SelectItem value="tennessee_walker">Tennessee Walker</SelectItem>
                  <SelectItem value="paso_fino">Paso Fino</SelectItem>
                  <SelectItem value="mangalarga">Mangalarga Marchador</SelectItem>
                  <SelectItem value="missouri_fox_trotter">Missouri Fox Trotter</SelectItem>
                  <SelectItem value="rocky_mountain">Rocky Mountain Horse</SelectItem>
                  <SelectItem value="other">{t("conf.breedOther")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("conf.dmrt3Genotype")}</Label>
              <Select value={dmrt3Genotype} onValueChange={setDmrt3Genotype} disabled={!!selectedHorseId}>
                <SelectTrigger><SelectValue placeholder={t("conf.dmrt3Placeholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AA">{t("conf.dmrt3AA")}</SelectItem>
                  <SelectItem value="CA">{t("conf.dmrt3CA")}</SelectItem>
                  <SelectItem value="CC">{t("conf.dmrt3CC")}</SelectItem>
                  <SelectItem value="unknown">{t("conf.dmrt3Unknown")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAnalyze} disabled={!imageBase64 || isAnalyzing} className="w-full mt-4" size="lg">
              {isAnalyzing ? (<><Loader2 className="h-4 w-4 animate-spin" /> {t("conf.analyzing")}</>) : (<><Camera className="h-4 w-4" /> {t("conf.analyzeBtn")}</>)}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5 mb-8">
          <CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><p className="text-sm text-destructive">{error}</p></CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="mb-8">
          <CardContent className="p-6 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">{t("conf.analyzingProgress")}</p>
            <Progress value={45} className="max-w-xs mx-auto" />
          </CardContent>
        </Card>
      )}

      {result && <ConformationResults result={result} suitabilityScore={suitabilityScore} />}
      <ConformationHistory refreshKey={historyRefresh} onViewRecord={handleViewHistoryRecord} />
    </div>
  );
}
