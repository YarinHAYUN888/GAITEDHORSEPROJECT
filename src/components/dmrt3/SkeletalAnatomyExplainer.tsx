import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface JointInfo {
  id: string; nameHe: string; nameEn: string; cx: number; cy: number;
  descriptionHe: string; descriptionEn: string; region: "forelimb" | "hindlimb" | "body";
}

const JOINTS: JointInfo[] = [
  { id: "scapula", nameHe: "שכמה", nameEn: "Scapula", cx: 145, cy: 60, descriptionHe: "עצם השכמה נעה חופשית — אין מפרק אמיתי עם הגוף. תנועתה קריטית לספיגת זעזועים.", descriptionEn: "The scapula moves freely — no true joint with the body. Its movement is critical for shock absorption.", region: "forelimb" },
  { id: "shoulder", nameHe: "כתף", nameEn: "Shoulder", cx: 150, cy: 100, descriptionHe: "מפרק הכתף מגביל תנועה לכיפוף ויישור. זווית אידיאלית: 100-120°.", descriptionEn: "The shoulder joint limits movement to flexion and extension. Ideal angle: 100-120°.", region: "forelimb" },
  { id: "elbow", nameHe: "מרפק", nameEn: "Elbow", cx: 140, cy: 140, descriptionHe: "מפרק ציר — מאפשר כיפוף ויישור בלבד. חיוני ליציבות.", descriptionEn: "Hinge joint — allows only flexion and extension. Essential for stability.", region: "forelimb" },
  { id: "carpus", nameHe: "קרפוס", nameEn: "Carpus", cx: 135, cy: 190, descriptionHe: "3 מפרקים קטנים — מגדילים רדיוס כיפוף. אזור פגיע לפציעות.", descriptionEn: "3 small joints — increase flexion radius. Injury-prone area.", region: "forelimb" },
  { id: "f_fetlock", nameHe: "פטלוק קדמי", nameEn: "Front Fetlock", cx: 135, cy: 230, descriptionHe: "מפרק בעל טווח תנועה גדול. נושא עומס מקסימלי ברגע הנחיתה.", descriptionEn: "Joint with large range of motion. Bears maximum load at landing.", region: "forelimb" },
  { id: "f_coffin", nameHe: "ארון קדמי", nameEn: "Front Coffin", cx: 135, cy: 265, descriptionHe: "המפרק הדיסטלי ביותר — בתוך הפרסה. נזק כאן גורם לתסמונת נביקולרית.", descriptionEn: "The most distal joint — inside the hoof. Damage here causes navicular syndrome.", region: "forelimb" },
  { id: "pelvis", nameHe: "אגן", nameEn: "Pelvis", cx: 305, cy: 55, descriptionHe: "האגן מעביר כוח מהגפיים האחוריות לעמוד השדרה — מנוע ההנעה.", descriptionEn: "The pelvis transfers force from hindlimbs to spine — the propulsion engine.", region: "hindlimb" },
  { id: "hip", nameHe: "ירך", nameEn: "Hip", cx: 310, cy: 90, descriptionHe: "מפרק כדורי — טווח תנועה רחב. חיוני להנעה ודחיפה.", descriptionEn: "Ball-and-socket joint — wide range of motion. Essential for propulsion.", region: "hindlimb" },
  { id: "stifle", nameHe: "ברך", nameEn: "Stifle", cx: 320, cy: 130, descriptionHe: "המקבילה לברך האנושית. כולל פטלה ורצועות צולבות.", descriptionEn: "Equivalent to the human knee. Includes patella and cruciate ligaments.", region: "hindlimb" },
  { id: "hock", nameHe: "קרסול", nameEn: "Hock", cx: 310, cy: 180, descriptionHe: "מפרק מורכב מ-4 שורות עצמות. אתר שכיח לספאווין (דלקת ניוונית).", descriptionEn: "Complex joint with 4 rows of bones. Common site for bone spavin (OA).", region: "hindlimb" },
  { id: "h_fetlock", nameHe: "פטלוק אחורי", nameEn: "Hind Fetlock", cx: 310, cy: 225, descriptionHe: "דומה לקדמי אך נושא פחות משקל. חשוב בשלב הדחיפה.", descriptionEn: "Similar to front but bears less weight. Important during push-off phase.", region: "hindlimb" },
  { id: "h_coffin", nameHe: "ארון אחורי", nameEn: "Hind Coffin", cx: 310, cy: 260, descriptionHe: "נקודת המגע עם הקרקע. כוח הדחיפה עובר דרכו.", descriptionEn: "Ground contact point. Propulsion force passes through it.", region: "hindlimb" },
  { id: "withers", nameHe: "שכם", nameEn: "Withers", cx: 195, cy: 40, descriptionHe: "הנקודה הגבוהה ביותר — T3-T8. שם נמדד גובה הסוס.", descriptionEn: "The highest point — T3-T8. Where horse height is measured.", region: "body" },
  { id: "thoracic", nameHe: "חוליות חזיות", nameEn: "Thoracic", cx: 225, cy: 35, descriptionHe: "18 חוליות חזיות — תנועה מוגבלת. נושאות את הצלעות.", descriptionEn: "18 thoracic vertebrae — limited movement. Support the ribs.", region: "body" },
  { id: "lumbar", nameHe: "חוליות מותניות", nameEn: "Lumbar", cx: 270, cy: 38, descriptionHe: "6 חוליות — אזור כיפוף ראשי. חיוני לאיסוף ודחיפה.", descriptionEn: "6 vertebrae — main flexion area. Essential for collection and push.", region: "body" },
  { id: "sternum", nameHe: "עצם החזה", nameEn: "Sternum", cx: 210, cy: 160, descriptionHe: "עצם החזה מחברת את הצלעות מלמטה. תומכת במבנה בית החזה.", descriptionEn: "The sternum connects ribs from below. Supports thorax structure.", region: "body" },
];

const CONNECTIONS: [string, string][] = [
  ["scapula", "shoulder"], ["shoulder", "elbow"], ["elbow", "carpus"], ["carpus", "f_fetlock"], ["f_fetlock", "f_coffin"],
  ["pelvis", "hip"], ["hip", "stifle"], ["stifle", "hock"], ["hock", "h_fetlock"], ["h_fetlock", "h_coffin"],
  ["withers", "thoracic"], ["thoracic", "lumbar"], ["lumbar", "pelvis"], ["withers", "scapula"],
];
const FORCE_CHAIN: string[] = ["h_coffin", "h_fetlock", "hock", "stifle", "hip", "pelvis", "lumbar", "thoracic", "withers"];
const regionColors: Record<string, string> = { forelimb: "hsl(var(--primary))", hindlimb: "hsl(210, 70%, 50%)", body: "hsl(45, 80%, 50%)" };

export default function SkeletalAnatomyExplainer() {
  const [selected, setSelected] = useState<JointInfo | null>(null);
  const [showForceChain, setShowForceChain] = useState(false);
  const { t, lang } = useLanguage();
  const jointMap = Object.fromEntries(JOINTS.map(j => [j.id, j]));

  const regionLabel = (r: string) => r === "forelimb" ? t("skel.forelimb") : r === "hindlimb" ? t("skel.hindlimb") : t("skel.bodyLabel");

  return (
    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-rubik flex items-center gap-2">{t("skel.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("skel.subtitle")}</p>
          <div className="flex gap-2 flex-wrap mt-1">
            <Badge variant="outline" style={{ borderColor: regionColors.forelimb }}>{t("skel.forelimb")}</Badge>
            <Badge variant="outline" style={{ borderColor: regionColors.hindlimb }}>{t("skel.hindlimb")}</Badge>
            <Badge variant="outline" style={{ borderColor: regionColors.body }}>{t("skel.bodyLabel")}</Badge>
            <button onClick={() => setShowForceChain(f => !f)} className="text-xs underline text-muted-foreground hover:text-foreground transition-colors">
              {showForceChain ? t("skel.hideForce") : t("skel.showForce")} {t("skel.forceChain")}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <svg viewBox="0 0 440 290" className="w-full h-auto">
              <ellipse cx="225" cy="110" rx="120" ry="55" fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1" />
              <ellipse cx="110" cy="45" rx="30" ry="18" fill="hsl(var(--muted) / 0.2)" stroke="hsl(var(--border))" strokeWidth="1" />
              <path d="M 135 55 Q 145 50 155 50" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <path d="M 345 55 Q 370 40 380 55" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
              {CONNECTIONS.map(([a, b]) => {
                const ja = jointMap[a]; const jb = jointMap[b]; if (!ja || !jb) return null;
                return <line key={`${a}-${b}`} x1={ja.cx} y1={ja.cy} x2={jb.cx} y2={jb.cy} stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={0.3} />;
              })}
              {showForceChain && FORCE_CHAIN.map((id, i) => {
                if (i === 0) return null;
                const prev = jointMap[FORCE_CHAIN[i - 1]]; const curr = jointMap[id]; if (!prev || !curr) return null;
                return <motion.line key={`force-${id}`} x1={prev.cx} y1={prev.cy} x2={curr.cx} y2={curr.cy} stroke="hsl(0, 84%, 60%)" strokeWidth="3" opacity={0.7} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: i * 0.1 }} />;
              })}
              {showForceChain && (
                <>
                  <motion.line x1={310} y1={280} x2={310} y2={260} stroke="hsl(0, 84%, 60%)" strokeWidth="2.5" markerEnd="url(#arrowhead)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
                  <defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="hsl(0, 84%, 60%)" /></marker></defs>
                  <text x="325" y="278" fill="hsl(0, 84%, 60%)" fontSize="8">GRF ↑</text>
                </>
              )}
              {JOINTS.map(j => (
                <g key={j.id} onClick={() => setSelected(j)} className="cursor-pointer">
                  <motion.circle cx={j.cx} cy={j.cy} r={selected?.id === j.id ? 10 : 7} fill={regionColors[j.region]}
                    stroke={selected?.id === j.id ? "hsl(var(--foreground))" : "hsl(var(--background))"} strokeWidth={selected?.id === j.id ? 2.5 : 1.5} whileHover={{ scale: 1.3 }} transition={{ type: "spring", stiffness: 400 }} />
                  <text x={j.cx} y={j.cy - 12} fill="hsl(var(--muted-foreground))" fontSize="7" textAnchor="middle" className="pointer-events-none">
                    {lang === 'en' ? j.nameEn : j.nameHe}
                  </text>
                </g>
              ))}
            </svg>
            <AnimatePresence>
              {selected && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-2 left-2 right-2 bg-card border border-border rounded-lg p-3 shadow-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{lang === 'en' ? selected.nameEn : selected.nameHe} ({lang === 'en' ? selected.nameHe : selected.nameEn})</h4>
                      <Badge variant="outline" className="text-xs mt-1" style={{ borderColor: regionColors[selected.region] }}>{regionLabel(selected.region)}</Badge>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{lang === 'en' ? selected.descriptionEn : selected.descriptionHe}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
