import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Posture {
  id: string; nameHe: string; nameEn: string; isHealthy: boolean;
  descriptionHe: string; descriptionEn: string; oaRiskHe: string; oaRiskEn: string;
  joints: Record<string, [number, number]>; stressedJoints: string[]; spinalCurve: number;
}

const POSTURES: Posture[] = [
  { id: "normal", nameHe: "עמידה תקינה", nameEn: "Normal Standing", isHealthy: true,
    descriptionHe: "משקל מאוזן על 4 גפיים, עמוד שדרה ישר, ללא סיבוב רוחבי.", descriptionEn: "Weight balanced on 4 limbs, straight spine, no lateral rotation.",
    oaRiskHe: "ללא סיכון", oaRiskEn: "No risk",
    joints: { poll: [60,25], withers: [110,35], back: [160,38], croup: [210,42], shoulder: [100,70], elbow: [95,110], carpus: [92,150], f_fetlock: [90,180], f_hoof: [90,200], hip: [220,70], stifle: [230,110], hock: [225,155], h_fetlock: [222,180], h_hoof: [222,200] },
    stressedJoints: [], spinalCurve: 0 },
  { id: "lateral_rotation", nameHe: "סיבוב רוחבי", nameEn: "Lateral Rotation", isHealthy: false,
    descriptionHe: "עמוד השדרה מסובב לצד — גורם לעומס יתר על הגפה הקדמית בצד הנגדי.", descriptionEn: "Spine rotated to one side — causes overloading of the contralateral front limb.",
    oaRiskHe: "סיכון גבוה — ארון, פטלוק, נביקולרי", oaRiskEn: "High risk — coffin, fetlock, navicular",
    joints: { poll: [55,22], withers: [108,32], back: [158,30], croup: [208,40], shoulder: [95,68], elbow: [88,108], carpus: [84,148], f_fetlock: [82,178], f_hoof: [82,200], hip: [220,68], stifle: [232,108], hock: [228,152], h_fetlock: [226,180], h_hoof: [226,200] },
    stressedJoints: ["f_fetlock","f_hoof","carpus"], spinalCurve: 12 },
  { id: "forelimb_overload", nameHe: "העמסת יתר קדמית", nameEn: "Forelimb Overload", isHealthy: false,
    descriptionHe: "משקל מופנה קדימה — שכיח בסוסים עם כאב בגפיים אחוריות.", descriptionEn: "Weight shifted forward — common in horses with hindlimb pain. Front limbs bear 65%+ of weight.",
    oaRiskHe: "סיכון גבוה — מפרקי הקדמיות", oaRiskEn: "High risk — front limb joints",
    joints: { poll: [50,30], withers: [105,38], back: [155,42], croup: [205,50], shoulder: [95,75], elbow: [88,115], carpus: [84,155], f_fetlock: [82,185], f_hoof: [80,200], hip: [218,72], stifle: [228,108], hock: [225,150], h_fetlock: [224,178], h_hoof: [224,200] },
    stressedJoints: ["f_fetlock","f_hoof","carpus","elbow"], spinalCurve: 3 },
  { id: "rearing", nameHe: "גידול (Rearing)", nameEn: "Rearing", isHealthy: false,
    descriptionHe: "הסוס עומד על הגפיים האחוריות — כל המשקל על מפרקי האחוריות.", descriptionEn: "Horse standing on hind limbs — all weight on hind joints. Extreme load on hock and stifle.",
    oaRiskHe: "סיכון קריטי — קרסול, ברך, אגן", oaRiskEn: "Critical risk — hock, stifle, pelvis",
    joints: { poll: [100,5], withers: [130,20], back: [165,35], croup: [200,55], shoulder: [115,40], elbow: [108,55], carpus: [105,75], f_fetlock: [103,95], f_hoof: [102,110], hip: [210,80], stifle: [225,120], hock: [220,165], h_fetlock: [218,188], h_hoof: [218,200] },
    stressedJoints: ["hock","stifle","hip","h_fetlock"], spinalCurve: -5 },
];

function PostureSVG({ posture }: { posture: Posture }) {
  const { joints, stressedJoints } = posture;
  const connections: [string, string][] = [
    ["poll","withers"],["withers","back"],["back","croup"],
    ["shoulder","elbow"],["elbow","carpus"],["carpus","f_fetlock"],["f_fetlock","f_hoof"],
    ["hip","stifle"],["stifle","hock"],["hock","h_fetlock"],["h_fetlock","h_hoof"],
    ["withers","shoulder"],["croup","hip"],
  ];
  const isStressed = (id: string) => stressedJoints.includes(id);
  return (
    <svg viewBox="0 0 300 220" className="w-full h-auto" style={{ maxWidth: 280 }}>
      <line x1="20" y1="205" x2="280" y2="205" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
      {connections.map(([a, b]) => {
        const pa = joints[a]; const pb = joints[b]; if (!pa || !pb) return null;
        const stressed = isStressed(a) || isStressed(b);
        return <line key={`${a}-${b}`} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke={stressed ? "hsl(0, 84%, 60%)" : "hsl(var(--muted-foreground))"} strokeWidth={stressed ? 2.5 : 1.5} opacity={stressed ? 0.9 : 0.5} />;
      })}
      {Object.entries(joints).map(([id, [cx, cy]]) => (
        <motion.circle key={id} cx={cx} cy={cy} r={isStressed(id) ? 6 : 4}
          fill={isStressed(id) ? "hsl(0, 84%, 60%)" : "hsl(120, 50%, 45%)"} stroke="hsl(var(--background))" strokeWidth={1}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }} />
      ))}
      {posture.spinalCurve !== 0 && (
        <text x="155" y="25" fill="hsl(var(--muted-foreground))" fontSize="8" textAnchor="middle">
          {posture.spinalCurve}°
        </text>
      )}
    </svg>
  );
}

export default function PostureComparisonTool() {
  const [selectedIdx, setSelectedIdx] = useState(1);
  const { t, lang } = useLanguage();
  const normal = POSTURES[0];
  const selected = POSTURES[selectedIdx];
  const isEn = lang === 'en';

  return (
    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-rubik">{t("post.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("post.subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {POSTURES.slice(1).map((p, i) => (
              <Button key={p.id} variant={selectedIdx === i + 1 ? "default" : "outline"} size="sm" onClick={() => setSelectedIdx(i + 1)}>
                {isEn ? p.nameEn : p.nameHe}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center space-y-2">
              <Badge className="bg-green-500/15 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> {t("post.normal")}</Badge>
              <PostureSVG posture={normal} />
              <p className="text-xs text-muted-foreground">{isEn ? normal.nameEn : normal.nameHe}</p>
            </div>
            <div className="text-center space-y-2">
              <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> {t("post.pathological")}</Badge>
              <PostureSVG posture={selected} />
              <p className="text-xs text-muted-foreground">{isEn ? selected.nameEn : selected.nameHe}</p>
            </div>
          </div>
          <motion.div key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-muted/30 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm">{isEn ? selected.nameEn : selected.nameHe} ({isEn ? selected.nameHe : selected.nameEn})</h4>
            <p className="text-sm text-muted-foreground">{isEn ? selected.descriptionEn : selected.descriptionHe}</p>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-destructive font-medium">{isEn ? selected.oaRiskEn : selected.oaRiskHe}</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{t("post.stressedJoints")}</span>
              {selected.stressedJoints.map(j => (<Badge key={j} variant="destructive" className="text-[10px] px-1.5 py-0">{j}</Badge>))}
            </div>
          </motion.div>
          <div className="flex gap-4 justify-center text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /><span>{t("post.balancedJoint")}</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /><span>{t("post.stressedJoint")}</span></div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
