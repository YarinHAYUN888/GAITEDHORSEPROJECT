import { useState, useEffect, lazy, Suspense } from "react";
import { Shield, Send, CheckCircle2, ShieldCheck, Tag, Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeConsensus } from "@/lib/consensusEngine";
import type { BiomechMetrics } from "@/types/biomech";
import type { LabelVote } from "@/types/pipeline";

const FootfallEventPlot = lazy(() => import("@/components/gait/FootfallEventPlot"));

const GAIT_TYPES = [
  { value: "walk", label: "Walk / שיפול" },
  { value: "trot", label: "Trot / טרוט" },
  { value: "canter", label: "Canter / גלופ" },
  { value: "toelt", label: "Tölt / טולט" },
  { value: "pace", label: "Pace / פייס" },
  { value: "running_walk", label: "Running Walk" },
  { value: "rack", label: "Rack / ראק" },
  { value: "fox_trot", label: "Fox Trot" },
  { value: "paso_fino", label: "Paso Fino / פאסו" },
  { value: "singlefoot", label: "Singlefoot / סינגלפוט" },
];

const VALIDATION_TAGS = [
  { value: "clean", labelKey: "val.tagClean" },
  { value: "mixed", labelKey: "val.tagMixed" },
  { value: "breaking", labelKey: "val.tagBreaking" },
  { value: "lateral_drift", labelKey: "val.tagLateralDrift" },
  { value: "pace_tendency", labelKey: "val.tagPaceTendency" },
  { value: "irregular_rhythm", labelKey: "val.tagIrregularRhythm" },
  { value: "occlusion_issue", labelKey: "val.tagOcclusion" },
  { value: "camera_instability", labelKey: "val.tagCameraShake" },
  { value: "speed_change", labelKey: "val.tagSpeedChange" },
];

const SURFACES = [
  { value: "arena", label: "מגרש אילוף" },
  { value: "trail", label: "שטח" },
  { value: "road", label: "כביש" },
  { value: "unknown", label: "לא ידוע" },
];

const SPEEDS = [
  { value: "slow", label: "איטי" },
  { value: "moderate", label: "בינוני" },
  { value: "fast", label: "מהיר" },
  { value: "unknown", label: "לא ידוע" },
];

interface Props {
  analysisId?: string;
  detectedGaitType?: string;
  biomechMetrics?: BiomechMetrics;
}

export default function ValidationPanel({ analysisId, detectedGaitType, biomechMetrics }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isCoach, setIsCoach] = useState(false);
  const [userRole, setUserRole] = useState<"user" | "coach" | "admin">("user");
  const [gaitType, setGaitType] = useState(detectedGaitType || "");
  const [altGaitType, setAltGaitType] = useState("");
  const [confidence, setConfidence] = useState([3]);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [surface, setSurface] = useState("unknown");
  const [speed, setSpeed] = useState("unknown");
  const [sideView, setSideView] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationCount, setValidationCount] = useState(0);
  const [consensus, setConsensus] = useState<Array<{ labeled_gait_type: string; vote_count: number; avg_confidence: number }>>([]);
  const [consensusResult, setConsensusResult] = useState<{ finalLabel: string; agreement: number; stable: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as const }).then(({ data }) => {
      setIsCoach(!!data);
      setUserRole(data ? "admin" : "user");
    });
    (supabase.from("gait_label_votes" as any) as any).select("id", { count: "exact", head: true }).eq("annotator_id", user.id).then(({ count }: any) => {
      setValidationCount(count || 0);
    });
  }, [user]);

  useEffect(() => {
    if (!analysisId) return;
    // Load votes from new table
    (supabase.from("gait_label_votes" as any) as any).select("*").eq("analysis_id", analysisId).then(({ data }: any) => {
      if (!data || data.length === 0) {
        // Fallback to legacy table
        (supabase.from("gait_validations" as any) as any).select("labeled_gait_type, confidence").eq("analysis_id", analysisId).then(({ data: legacyData }: any) => {
          if (!legacyData) return;
          const grouped = new Map<string, { count: number; totalConf: number }>();
          for (const row of legacyData) {
            const g = grouped.get(row.labeled_gait_type) || { count: 0, totalConf: 0 };
            g.count++;
            g.totalConf += row.confidence || 3;
            grouped.set(row.labeled_gait_type, g);
          }
          setConsensus(Array.from(grouped.entries()).map(([gt, v]) => ({
            labeled_gait_type: gt,
            vote_count: v.count,
            avg_confidence: v.totalConf / v.count,
          })));
        });
        return;
      }

      // Use new table data
      const grouped = new Map<string, { count: number; totalConf: number }>();
      for (const row of data) {
        const g = grouped.get(row.label) || { count: 0, totalConf: 0 };
        g.count++;
        g.totalConf += row.confidence || 3;
        grouped.set(row.label, g);
      }
      setConsensus(Array.from(grouped.entries()).map(([gt, v]) => ({
        labeled_gait_type: gt,
        vote_count: v.count,
        avg_confidence: v.totalConf / v.count,
      })));

      // Compute consensus if 3+ votes
      if (data.length >= 3) {
        const votes: LabelVote[] = data.map((d: any) => ({
          analysisId: d.analysis_id,
          label: d.label,
          confidence: d.confidence,
          annotatorId: d.annotator_id,
          annotatorRole: d.annotator_role,
        }));
        const result = computeConsensus(analysisId, votes);
        setConsensusResult(result);
      }
    });
  }, [analysisId, submitted]);

  if (!isCoach || !analysisId) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async () => {
    if (!user || !gaitType) return;
    setLoading(true);
    try {
      // Write to new ground truth table
      const alternatives = altGaitType ? [{ label: altGaitType, confidence: Math.max(1, confidence[0] - 1) }] : [];
      const captureMeta = { sideView, surface, speed };

      const { error } = await (supabase.from("gait_label_votes" as any) as any).upsert({
        analysis_id: analysisId,
        annotator_id: user.id,
        annotator_role: userRole,
        label: gaitType,
        confidence: confidence[0],
        alternatives: JSON.stringify(alternatives),
        tags: JSON.stringify(selectedTags),
        notes: comment || null,
        capture_meta: JSON.stringify(captureMeta),
      }, { onConflict: "analysis_id,annotator_id" });
      if (error) throw error;

      // Also write to legacy table for backward compatibility
      await (supabase.from("gait_validations" as any) as any).upsert({
        analysis_id: analysisId,
        validator_id: user.id,
        labeled_gait_type: gaitType,
        confidence: confidence[0],
        comment: [comment, selectedTags.length > 0 ? `[tags: ${selectedTags.join(", ")}]` : ""].filter(Boolean).join(" ") || null,
      }, { onConflict: "analysis_id,validator_id" });

      setSubmitted(true);
      setValidationCount(prev => prev + 1);
      toast.success(t("val.submitted"));
    } catch {
      toast.error(t("val.error"));
    } finally {
      setLoading(false);
    }
  };

  const hasContactEvents = biomechMetrics?.contactEvents && Object.values(biomechMetrics.contactEvents).some(v => v.length > 0);

  if (submitted) {
    return (
      <Card className="glass-card border-primary/20">
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{t("val.thanks")}</span>
            <Badge variant="outline" className="text-xs gap-1">
              <ShieldCheck className="h-3 w-3" />
              {validationCount} {t("val.totalLabels")}
            </Badge>
          </div>
          {consensusResult && (
            <div className="flex items-center gap-2">
              <Badge variant={consensusResult.stable ? "default" : "secondary"} className="text-xs">
                {t("val.consensus")}: {consensusResult.finalLabel} ({Math.round(consensusResult.agreement * 100)}%)
              </Badge>
              {consensusResult.stable && <Badge variant="default" className="text-xs">{t("val.stableLabel")}</Badge>}
            </div>
          )}
          {consensus.length > 0 && (
            <div className="flex gap-2 mr-auto">
              {consensus.map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {c.labeled_gait_type}: {c.vote_count} ({Number(c.avg_confidence).toFixed(1)}★)
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          {t("val.title")}
          <Badge variant="outline" className="text-xs mr-auto gap-1">
            <ShieldCheck className="h-3 w-3" />
            {validationCount} {t("val.totalLabels")}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inline Footfall Event Plot */}
        {hasContactEvents && biomechMetrics?.gait && (
          <Suspense fallback={<div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}>
            <div className="max-h-48 overflow-hidden rounded-lg border border-border/50">
              <FootfallEventPlot
                contacts={biomechMetrics.contactEvents!}
                beatEvenness={biomechMetrics.windows?.[0]?.features?.beatEvenness ?? 0}
                footfallOrder={biomechMetrics.windows?.[0]?.features?.footfallOrder ?? "unknown"}
              />
            </div>
          </Suspense>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">{t("val.gaitType")}</label>
            <Select value={gaitType} onValueChange={setGaitType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GAIT_TYPES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">{t("val.confidence")} ({confidence[0]}/5)</label>
            <Slider value={confidence} onValueChange={setConfidence} min={1} max={5} step={1} />
          </div>
        </div>

        {/* Alternative gait type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{t("val.altGaitType")}</label>
          <Select value={altGaitType || "none"} onValueChange={(v) => setAltGaitType(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={t("val.altPlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {GAIT_TYPES.filter(g => g.value !== gaitType).map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tag chips */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {t("val.tags")}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {VALIDATION_TAGS.map((tag) => (
              <Badge
                key={tag.value}
                variant={selectedTags.includes(tag.value) ? "default" : "outline"}
                className="cursor-pointer text-xs transition-colors"
                onClick={() => toggleTag(tag.value)}
              >
                {t(tag.labelKey)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Capture meta */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {t("val.captureMeta")}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Select value={surface} onValueChange={setSurface}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SURFACES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPEEDS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge
              variant={sideView ? "default" : "outline"}
              className="cursor-pointer text-xs flex items-center justify-center h-8"
              onClick={() => setSideView(!sideView)}
            >
              {sideView ? "✓ " : ""}{t("val.sideView")}
            </Badge>
          </div>
        </div>

        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("val.commentPlaceholder")} rows={2} />
        <Button onClick={handleSubmit} disabled={!gaitType || loading} size="sm" className="gap-2">
          <Send className="h-3.5 w-3.5" />
          {t("val.submit")}
        </Button>

        {consensus.length > 0 && (
          <div className="border-t border-border pt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("val.consensusSoFar")}</p>
            <div className="flex flex-wrap gap-2">
              {consensus.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {c.labeled_gait_type}: {c.vote_count} votes (avg {Number(c.avg_confidence).toFixed(1)}★)
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
