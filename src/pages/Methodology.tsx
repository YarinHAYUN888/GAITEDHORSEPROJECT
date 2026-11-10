import { motion } from "framer-motion";
import { BookOpen, Brain, Eye, Ear, Activity, Shield, Layers, CheckCircle2, ExternalLink, Cpu, BarChart3, Target, Calendar, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// ── Live accuracy from DB ────────────────────────────────
interface LiveAccuracy {
  totalValidated: number;
  gaitAccuracy: number | null;
  confusionPairs: { predicted: string; actual: string; count: number }[];
  lastUpdated: string;
}

async function fetchLiveAccuracy(): Promise<LiveAccuracy> {
  // Fetch validated analyses
  const { data: validations, error } = await supabase
    .from("gait_validations")
    .select("analysis_id, labeled_gait_type, confidence, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  if (!validations?.length) {
    return { totalValidated: 0, gaitAccuracy: null, confusionPairs: [], lastUpdated: "" };
  }

  const analysisIds = [...new Set(validations.map((v) => v.analysis_id))];
  const { data: analyses, error: analysisError } = await supabase
    .from("gait_analyses")
    .select("id, gait_type")
    .in("id", analysisIds);

  if (analysisError) throw analysisError;
  const seen = new Set<string>();
  const analysisMap = new Map((analyses ?? []).map((a) => [a.id, a.gait_type]));

  let correct = 0;
  let total = 0;
  const confusionMap = new Map<string, number>();

  for (const v of validations) {
    if (seen.has(v.analysis_id)) continue;
    seen.add(v.analysis_id);
    const predicted = analysisMap.get(v.analysis_id);
    if (!predicted || !v.labeled_gait_type) continue;
    total++;
    if (predicted.toLowerCase() === v.labeled_gait_type.toLowerCase()) {
      correct++;
    } else {
      const key = `${predicted}→${v.labeled_gait_type}`;
      confusionMap.set(key, (confusionMap.get(key) ?? 0) + 1);
    }
  }

  const confusionPairs = [...confusionMap.entries()]
    .map(([k, count]) => {
      const [predicted, actual] = k.split("→");
      return { predicted, actual, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalValidated: total,
    gaitAccuracy: total > 0 ? Math.round((correct / total) * 100) : null,
    confusionPairs,
    lastUpdated: validations[0]?.analysis_id ? validations[0].created_at : "",
  };
}

const PIPELINE_STAGES = [
  { icon: Eye, key: "vision", he: "ניתוח ויזואלי (Gemini Vision)", en: "Visual Analysis (Gemini Vision)", desc: { he: "חילוץ פריימים, זיהוי נקודות מפתח אנטומיות, ניתוח תנועה", en: "Frame extraction, anatomical keypoint detection, motion analysis" } },
  { icon: Cpu, key: "pose", he: "Pose Engine (ONNX)", en: "Pose Engine (ONNX)", desc: { he: "מנוע keypoints מקומי על המכשיר עם fallback ל-LLM", en: "On-device keypoint engine with LLM fallback" } },
  { icon: Ear, key: "audio", he: "ניתוח אודיו (FFT)", en: "Audio Analysis (FFT)", desc: { he: "זיהוי BPM, סדירות קצב, ניתוח peak amplitudes", en: "BPM detection, rhythm regularity, peak amplitude analysis" } },
  { icon: Activity, key: "biomech", he: "מנוע ביומכני", en: "Biomechanical Engine", desc: { he: "סגמנטציית צעדים, GRF, VSI, זיהוי פאזות", en: "Stride segmentation, GRF, VSI, phase detection" } },
  { icon: Layers, key: "fusion", he: "היתוך מולטי-מודאלי", en: "Multi-Modal Fusion", desc: { he: "שקלול ויז'ן + אודיו עם זיהוי סתירות", en: "Vision + Audio fusion with conflict detection" } },
  { icon: Shield, key: "critic", he: "Critic Engine", en: "Critic Engine", desc: { he: "בקרת איכות עצמית, consistency check, consensus", en: "Self-quality control, consistency check, consensus" } },
];

const REFERENCES = [
  { title: "Andersson et al. (2012)", journal: "Nature", desc: { he: "גילוי מוטציית DMRT3 ותפקידה בקואורדינציה של תנועת הרגליים", en: "Discovery of DMRT3 mutation and its role in limb coordination" }, doi: "10.1038/nature11399" },
  { title: "Hildebrand (1965)", journal: "Science", desc: { he: "סיווג צעדים סימטריים של סוסים — הבסיס לכל ניתוח ביומכני", en: "Symmetrical gaits of horses — the foundation of biomechanical analysis" }, doi: "10.1126/science.150.3697.701" },
  { title: "Shaffer et al. (2025)", journal: "Sensors", desc: { he: "ביומכניקת Full-Body Markerless של סוסים — תיקוף מדדים", en: "Markerless Full-Body Biomechanics of Horses — metric validation" }, doi: "10.3390/s25010001" },
  { title: "PFERD Dataset (2024)", journal: "Nature Scientific Data", desc: { he: "מאגר נתוני התנועה הגדול ביותר לסוסים — 30,000+ פריימים מתויגים", en: "Largest equine motion dataset — 30,000+ labeled frames" }, doi: "10.1038/s41597-024-03312-1" },
  { title: "Pfau & Sepulveda Caviedes (2023)", journal: "Equine Vet. J.", desc: { he: "VSI — מדד סימטריה אנכית לזיהוי צליעה", en: "VSI — Vertical Symmetry Index for lameness detection" }, doi: "10.1111/evj.13900" },
  { title: "Clayton et al. (2013)", journal: "Vet. J.", desc: { he: "טווחי זוויות מפרק נורמליים בסוסים — כתף, מרפק, קרפוס", en: "Normal joint angle ranges in horses — shoulder, elbow, carpus" }, doi: "10.1016/j.tvjl.2013.09.023" },
  { title: "Rhodin et al. (2018)", journal: "PLoS ONE", desc: { he: "תיקוף ניתוח תנועה ללא סמנים — מדדי דיוק", en: "Markerless motion analysis validation — accuracy metrics" }, doi: "10.1371/journal.pone.0205552" },
];

// ── Confusion Matrix Cell ────────────────────────────────
function ConfusionCell({ predicted, actual, count }: { predicted: string; actual: string; count: number }) {
  const intensity = Math.min(count * 15, 100);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="rounded-md p-2 text-center text-xs font-mono cursor-default transition-colors"
          style={{ backgroundColor: `hsl(0 84% 60% / ${intensity}%)` }}
        >
          {count}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{predicted} → {actual} ({count})</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Methodology() {
  const { lang, t } = useLanguage();
  const isHe = lang === "he";

  const { data: liveData, isPending, isError } = useQuery({
    queryKey: ["methodology-live-accuracy"],
    queryFn: fetchLiveAccuracy,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="py-12">
      <div className="container max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">
            {isHe ? "מתודולוגיה ומדדי דיוק" : "Methodology & Accuracy Metrics"}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            {isHe
              ? "איך עובד ניתוח התנועה שלנו, אילו אלגוריתמים פועלים מאחורי הקלעים, ומהו הדיוק שנמדד"
              : "How our gait analysis works, the algorithms behind the scenes, and measured accuracy"}
          </p>
        </motion.div>

        {/* Accuracy Metrics — live from DB */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {isHe ? "מדדי דיוק" : "Accuracy Metrics"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isHe ? "התאמה לתיוג האחרון של כל ניתוח נגיש — לא תיקוף קליני ולא מדגם סינגלפוט עצמאי." : "Agreement with the latest label per accessible analysis — not clinical validation or an independent Singlefoot benchmark."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-bold">
                {isPending ? (isHe ? "טוען…" : "Loading…") : isError ? (isHe ? "נתוני האימות אינם זמינים" : "Validation data unavailable") : liveData?.gaitAccuracy != null ? `${liveData.gaitAccuracy}%` : (isHe ? "טרם נמדד" : "Not yet measured")}
              </p>
              <p className="text-sm text-muted-foreground">
                {isHe ? "ניתוחים עם תיוג:" : "Labeled analyses:"} {isError || isPending ? "—" : liveData?.totalValidated ?? 0}
              </p>
              {liveData?.lastUpdated && <p className="text-xs text-muted-foreground">{isHe ? "תיוג אחרון:" : "Latest label:"} {new Date(liveData.lastUpdated).toLocaleDateString(isHe ? "he-IL" : "en-GB")}</p>}
              <p className="text-sm text-muted-foreground">{isHe ? "דיוק SI, תזמון פרסות וסינגלפוט: טרם אומת מול סרטונים מתויגים נפרדים. ביטחון המודל אינו דיוק שנמדד." : "SI, hoof timing and Singlefoot accuracy: not yet verified on a separate labeled video set. Model confidence is not measured accuracy."}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Confusion Matrix */}
        {liveData && liveData.confusionPairs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="glass-card mb-8">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {isHe ? "מטריצת בלבול — טעויות סיווג נפוצות" : "Confusion Matrix — Common Misclassifications"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {liveData.confusionPairs.map((pair) => (
                    <div key={`${pair.predicted}-${pair.actual}`} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="font-mono text-xs min-w-[80px] justify-center">
                        {pair.predicted}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="font-mono text-xs min-w-[80px] justify-center bg-destructive/10 text-destructive border-destructive/30">
                        {pair.actual}
                      </Badge>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive/60"
                          style={{ width: `${Math.min(pair.count * 10, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{pair.count}×</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  {isHe ? "מציג את הטעויות הנפוצות ביותר — מאפשר שקיפות מלאה" : "Shows the most common errors — full transparency"}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Pipeline Architecture */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                {isHe ? "ארכיטקטורת ה-Pipeline" : "Pipeline Architecture"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isHe ? "שלבי העיבוד המרכזיים מהסרטון ועד לתוצאה" : "Core processing stages from video to result"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {PIPELINE_STAGES.map((stage, i) => (
                <div key={stage.key} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <stage.icon className="h-5 w-5 text-primary" />
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && <div className="w-0.5 h-8 bg-border mt-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-foreground">{isHe ? stage.he : stage.en}</p>
                    <p className="text-sm text-muted-foreground">{isHe ? stage.desc.he : stage.desc.en}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Key Innovations */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {isHe ? "חידושים מרכזיים" : "Key Innovations"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { he: "היתוך מולטי-מודאלי (Multi-Modal Fusion)", en: "Multi-Modal Fusion", descHe: "שילוב ויז'ן + אודיו עם שקלול ביטחון — זיהוי סתירות בין מה שהעין רואה למה שהאוזן שומעת", descEn: "Vision + Audio fusion with confidence weighting — detecting contradictions between visual and auditory signals" },
                { he: "Critic Engine — בקרת איכות עצמית", en: "Critic Engine — Self-Quality Control", descHe: "מנגנון שבודק את עצמו: consistency check, consensus voting, ו-confidence calibration לפני שמוצגת תוצאה", descEn: "Self-checking mechanism: consistency check, consensus voting, and confidence calibration before displaying results" },
                { he: "התמחות בגזעי צעד (Gaited Breeds)", en: "Gaited Breeds Specialization", descHe: "תמיכה ב-13+ סוגי צעד כולל Tölt, Pace, Fox Trot, Running Walk ו-Rack — נישה שאף מתחרה לא מכסה", descEn: "Support for 13+ gait types including Tölt, Pace, Fox Trot, Running Walk and Rack — a niche no competitor covers" },
                { he: "קישור גנטיקה-ביומכניקה (DMRT3)", en: "Genetics-Biomechanics Link (DMRT3)", descHe: "ניתוח שמביא בחשבון את הגנוטיפ של הסוס ומתאים ציפיות לתנועה בהתאם", descEn: "Analysis that factors in the horse's genotype and adjusts movement expectations accordingly" },
              ].map((item) => (
                <div key={item.en} className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">{isHe ? item.he : item.en}</p>
                    <p className="text-sm text-muted-foreground">{isHe ? item.descHe : item.descEn}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Scientific References */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {isHe ? "הפניות מדעיות" : "Scientific References"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isHe ? "מקורות לעיון — אינם הוכחת תיקוף המערכת" : "Background references — not proof of system validation"}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCES.map((ref) => (
                <div key={ref.title} className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{ref.title}</span>
                    <Badge variant="outline" className="text-[10px]">{ref.journal}</Badge>
                    {ref.doi && (
                      <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{isHe ? ref.desc.he : ref.desc.en}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
