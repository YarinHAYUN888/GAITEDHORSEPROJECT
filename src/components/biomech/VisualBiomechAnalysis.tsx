import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Loader2, AlertTriangle, CheckCircle2, Info,
  ChevronDown, ChevronUp, Eye, Activity, Bone, ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { extractFrames } from "@/lib/extractFrames";
import { toast } from "sonner";

/* ─── Types ─── */
interface AnnotationRegion {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  type: "joint" | "muscle_group" | "posture" | "force_line";
  status: "normal" | "attention" | "concern";
  detail: string;
}

interface ClinicalFlag {
  area: string;
  concern: string;
  severity: "info" | "mild" | "moderate" | "severe";
  recommendation: string;
}

interface VisualAnalysisResult {
  postureAssessment: {
    headPosition: string;
    headPositionNote: string;
    neckAngle: string;
    neckNote: string;
    backline: string;
    backlineNote: string;
    hindquarterEngagement: string;
    hindquarterNote: string;
  };
  limbAnalysis: {
    frontLimbs: { phase: string; alignment: string; alignmentNote: string; strideCharacter: string };
    hindLimbs: { phase: string; alignment: string; alignmentNote: string; strideCharacter: string; trackingUp: string };
  };
  weightDistribution: {
    frontHindRatio: string;
    lateralBalance: string;
    note: string;
  };
  movementQuality: {
    overallImpression: string;
    rhythm: string;
    suppleness: string;
    impulsion: string;
    summaryHe: string;
  };
  clinicalFlags: ClinicalFlag[];
  annotationRegions: AnnotationRegion[];
  researchNotes: string;
}

interface Props {
  videoFile: File | null;
  gaitType?: string;
  breedId?: string;
}

/* ─── Helpers ─── */
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  normal: { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  attention: { bg: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-400", ring: "ring-amber-500/30" },
  concern: { bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-400", ring: "ring-red-500/30" },
};

const SEVERITY_MAP: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  info: { icon: Info, color: "text-blue-400", label: "מידע" },
  mild: { icon: Info, color: "text-amber-400", label: "קל" },
  moderate: { icon: AlertTriangle, color: "text-orange-400", label: "בינוני" },
  severe: { icon: AlertTriangle, color: "text-red-400", label: "חמור" },
};

const QUALITY_MAP: Record<string, { color: string; label: string }> = {
  poor: { color: "bg-red-500", label: "חלש" },
  fair: { color: "bg-orange-500", label: "סביר" },
  moderate: { color: "bg-amber-500", label: "בינוני" },
  good: { color: "bg-emerald-500", label: "טוב" },
  excellent: { color: "bg-primary", label: "מצוין" },
};

/* ─── Annotation Dot ─── */
function AnnotationDot({ region, isSelected, onClick }: {
  region: AnnotationRegion; isSelected: boolean; onClick: () => void;
}) {
  const colors = STATUS_COLORS[region.status] || STATUS_COLORS.normal;
  return (
    <motion.button
      className={`absolute z-10 rounded-full border-2 ${colors.border} ${colors.bg} cursor-pointer
        transition-all duration-200 hover:scale-125 focus:outline-none focus:ring-2 ${colors.ring}`}
      style={{
        left: `${region.xPercent * 100}%`,
        top: `${region.yPercent * 100}%`,
        transform: "translate(-50%, -50%)",
        width: isSelected ? 20 : 14,
        height: isSelected ? 20 : 14,
      }}
      onClick={onClick}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: Math.random() * 0.3, type: "spring" }}
      aria-label={region.label}
    >
      {isSelected && (
        <motion.div
          className={`absolute inset-0 rounded-full ${colors.border} border`}
          animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
    </motion.button>
  );
}

/* ─── Selected Annotation Tooltip ─── */
function AnnotationTooltip({ region }: { region: AnnotationRegion }) {
  const colors = STATUS_COLORS[region.status] || STATUS_COLORS.normal;
  const isRight = region.xPercent > 0.5;
  const isBottom = region.yPercent > 0.5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className={`absolute z-20 w-56 p-3 rounded-lg border ${colors.border} bg-card/95 backdrop-blur-sm shadow-lg`}
      style={{
        left: isRight ? undefined : `${region.xPercent * 100}%`,
        right: isRight ? `${(1 - region.xPercent) * 100}%` : undefined,
        top: isBottom ? undefined : `${region.yPercent * 100 + 3}%`,
        bottom: isBottom ? `${(1 - region.yPercent) * 100 + 3}%` : undefined,
      }}
    >
      <p className={`text-xs font-semibold ${colors.text} mb-1`}>{region.label}</p>
      <p className="text-xs text-foreground leading-relaxed">{region.detail}</p>
    </motion.div>
  );
}

/* ─── Posture Section ─── */
function PostureSection({ posture }: { posture: VisualAnalysisResult["postureAssessment"] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "מיקום ראש", value: posture.headPosition, note: posture.headPositionNote },
        { label: "זווית צוואר", value: posture.neckAngle, note: posture.neckNote },
        { label: "קו גב", value: posture.backline, note: posture.backlineNote },
        { label: "מעורבות אחורית", value: posture.hindquarterEngagement, note: posture.hindquarterNote },
      ].map((item) => (
        <div key={item.label} className="bg-muted/30 rounded-lg p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-sm font-medium text-foreground">{item.value}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export default memo(function VisualBiomechAnalysis({ videoFile, gaitType, breedId }: Props) {
  const [analysis, setAnalysis] = useState<VisualAnalysisResult | null>(null);
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    posture: true,
    limbs: false,
    clinical: false,
    research: false,
  });

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!videoFile) return;
    setLoading(true);
    setProgress(10);
    setAnalysis(null);

    try {
      // Extract a mid-video frame for best representation
      setProgress(20);
      const frames = await extractFrames(videoFile, 3);
      const bestFrame = frames[1] || frames[0]; // middle frame
      if (!bestFrame) throw new Error("לא ניתן לחלץ פריים מהסרטון");

      setFrameDataUrl(bestFrame);
      setProgress(40);

      // Send to AI for analysis
      const { data, error } = await supabase.functions.invoke("visual-biomech-analysis", {
        body: { frame: bestFrame, gaitType, breedId },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("מגבלת בקשות — נסה שוב בעוד דקה");
          return;
        }
        throw new Error(data.error);
      }

      setProgress(90);
      setAnalysis(data.analysis);
      setProgress(100);
      toast.success(`ניתוח ויזואלי הושלם (${data.processing_time_ms}ms)`);
    } catch (err: any) {
      console.error("Visual biomech analysis failed:", err);
      toast.error("שגיאה בניתוח הויזואלי: " + (err.message || "שגיאה לא ידועה"));
    } finally {
      setLoading(false);
    }
  }, [videoFile, gaitType, breedId]);

  // Auto-run when videoFile changes
  useEffect(() => {
    if (videoFile && !analysis && !loading) {
      runAnalysis();
    }
  }, [videoFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRegion = useMemo(
    () => analysis?.annotationRegions.find((r) => r.id === selectedAnnotation) ?? null,
    [analysis, selectedAnnotation]
  );

  const qualityInfo = useMemo(
    () => QUALITY_MAP[analysis?.movementQuality?.overallImpression ?? ""] || null,
    [analysis?.movementQuality?.overallImpression]
  );

  if (!videoFile) return null;

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          ניתוח ביומכני ויזואלי מבוסס AI
          {qualityInfo && (
            <Badge className={`${qualityInfo.color} text-white text-[10px] mr-auto`}>
              {qualityInfo.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Frame + Annotations */}
        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              מנתח את הפריים באמצעות AI...
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {frameDataUrl && (
          <div
            className="relative rounded-xl overflow-hidden bg-muted/30 cursor-crosshair"
            onClick={() => setSelectedAnnotation(null)}
          >
            <img
              src={frameDataUrl}
              alt="פריים מתוך סרטון הניתוח"
              className="w-full h-auto rounded-xl"
              style={{ filter: loading ? "brightness(0.7)" : undefined }}
            />

            {/* Annotation dots */}
            {analysis?.annotationRegions.map((region) => (
              <AnnotationDot
                key={region.id}
                region={region}
                isSelected={selectedAnnotation === region.id}
                onClick={() => {
                  setSelectedAnnotation(selectedAnnotation === region.id ? null : region.id);
                }}
              />
            ))}

            {/* Tooltip */}
            <AnimatePresence>
              {selectedRegion && <AnnotationTooltip region={selectedRegion} />}
            </AnimatePresence>

            {/* Legend */}
            {analysis && (
              <div className="absolute bottom-2 left-2 flex gap-2">
                {(["normal", "attention", "concern"] as const).map((status) => (
                  <div key={status} className="flex items-center gap-1 text-[10px] text-white/80 bg-black/50 rounded px-1.5 py-0.5">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].border} border`} />
                    {status === "normal" ? "תקין" : status === "attention" ? "לתשומת לב" : "חריגה"}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {analysis?.movementQuality && (
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              {analysis.movementQuality.summaryHe}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "קצב", value: analysis.movementQuality.rhythm === "regular" ? "סדיר" : analysis.movementQuality.rhythm === "mostly_regular" ? "סדיר ברובו" : "לא סדיר" },
                { label: "גמישות", value: analysis.movementQuality.suppleness === "supple" ? "גמיש" : analysis.movementQuality.suppleness === "moderate" ? "בינוני" : "נוקשה" },
                { label: "אימפולסיה", value: analysis.movementQuality.impulsion === "strong" ? "חזקה" : analysis.movementQuality.impulsion === "good" ? "טובה" : analysis.movementQuality.impulsion === "adequate" ? "מספקת" : "חסרה" },
              ].map((item) => (
                <Badge key={item.label} variant="secondary" className="text-[11px]">
                  {item.label}: {item.value}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Weight Distribution */}
        {analysis?.weightDistribution && (
          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ArrowUpDown className="h-4 w-4 text-primary" />
              חלוקת משקל
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                קדימה/אחורה: {analysis.weightDistribution.frontHindRatio}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {analysis.weightDistribution.lateralBalance === "even" ? "מאוזן צדדית" :
                  analysis.weightDistribution.lateralBalance === "left_heavy" ? "עומס שמאל" : "עומס ימין"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {analysis.weightDistribution.note}
            </p>
          </div>
        )}

        {/* Expandable sections */}
        {analysis && (
          <div className="space-y-2">
            {/* Posture */}
            <button
              onClick={() => toggleSection("posture")}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Bone className="h-4 w-4 text-primary" />
                יציבה ותנוחה
              </span>
              {expandedSections.posture ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <AnimatePresence>
              {expandedSections.posture && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <PostureSection posture={analysis.postureAssessment} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Limbs */}
            <button
              onClick={() => toggleSection("limbs")}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Activity className="h-4 w-4 text-primary" />
                ניתוח גפיים
              </span>
              {expandedSections.limbs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <AnimatePresence>
              {expandedSections.limbs && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">גפיים קדמיות</p>
                      <p className="text-xs text-muted-foreground">שלב: {analysis.limbAnalysis.frontLimbs.phase}</p>
                      <p className="text-xs text-muted-foreground">{analysis.limbAnalysis.frontLimbs.alignmentNote}</p>
                      <p className="text-[11px] text-foreground/80">{analysis.limbAnalysis.frontLimbs.strideCharacter}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">גפיים אחוריות</p>
                      <p className="text-xs text-muted-foreground">שלב: {analysis.limbAnalysis.hindLimbs.phase}</p>
                      <p className="text-xs text-muted-foreground">{analysis.limbAnalysis.hindLimbs.alignmentNote}</p>
                      <p className="text-[11px] text-foreground/80">{analysis.limbAnalysis.hindLimbs.strideCharacter}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {analysis.limbAnalysis.hindLimbs.trackingUp === "over-tracking" ? "עקיבת יתר" :
                          analysis.limbAnalysis.hindLimbs.trackingUp === "tracking-up" ? "עקיבה תקינה" : "תת-עקיבה"}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clinical Flags */}
            {analysis.clinicalFlags.length > 0 && (
              <>
                <button
                  onClick={() => toggleSection("clinical")}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    ממצאים קליניים
                    <Badge variant="destructive" className="text-[10px]">{analysis.clinicalFlags.length}</Badge>
                  </span>
                  {expandedSections.clinical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <AnimatePresence>
                  {expandedSections.clinical && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2">
                      {analysis.clinicalFlags.map((flag, i) => {
                        const sev = SEVERITY_MAP[flag.severity] || SEVERITY_MAP.info;
                        const Icon = sev.icon;
                        return (
                          <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-1 border border-muted">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${sev.color}`} />
                              <span className="text-xs font-medium text-foreground">{flag.area}</span>
                              <Badge variant="outline" className="text-[10px] mr-auto">{sev.label}</Badge>
                            </div>
                            <p className="text-xs text-foreground/80">{flag.concern}</p>
                            <p className="text-[11px] text-primary">{flag.recommendation}</p>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* Research Notes */}
            <button
              onClick={() => toggleSection("research")}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                📚 בסיס מחקרי
              </span>
              {expandedSections.research ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <AnimatePresence>
              {expandedSections.research && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/20 rounded-lg">
                    {analysis.researchNotes}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Re-analyze */}
        {analysis && (
          <Button
            variant="outline"
            size="sm"
            onClick={runAnalysis}
            disabled={loading}
            className="w-full"
          >
            <Camera className="h-4 w-4 ml-2" />
            נתח פריים חדש
          </Button>
        )}
      </CardContent>
    </Card>
  );
});
