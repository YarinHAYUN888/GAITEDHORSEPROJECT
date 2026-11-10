import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NUM_VERTEBRAE = 22;
const THORACIC = 18;

function computeVertebrae(flexionDeg: number, lateralDeg: number) {
  const verts: { x: number; y: number; topX: number; topY: number; stress: number }[] = [];
  const length = 360; const startX = 40; const baseY = 120;
  for (let i = 0; i < NUM_VERTEBRAE; i++) {
    const t = i / (NUM_VERTEBRAE - 1);
    const x = startX + t * length;
    const flexionOffset = Math.sin(t * Math.PI) * (flexionDeg / 10) * 12;
    const y = baseY - flexionOffset;
    const lateralOffset = Math.sin(t * Math.PI) * (lateralDeg / 15) * 30;
    const topX = x; const topY = 60 + lateralOffset;
    const midFactor = Math.sin(t * Math.PI);
    const stress = Math.min(1, (Math.abs(lateralDeg) / 15) * midFactor * 0.8 + (Math.abs(flexionDeg) / 15) * midFactor * 0.3);
    verts.push({ x, y, topX, topY, stress });
  }
  return verts;
}

function stressColor(stress: number): string {
  if (stress < 0.3) return "hsl(var(--primary))";
  if (stress < 0.6) return "hsl(45, 93%, 47%)";
  return "hsl(0, 84%, 60%)";
}

function computeLimbLoading(lateralDeg: number) {
  const bias = lateralDeg / 15;
  return { LF: Math.max(0.2, 0.5 + bias * 0.4), RF: Math.max(0.2, 0.5 - bias * 0.4), LH: Math.max(0.2, 0.5 + bias * 0.25), RH: Math.max(0.2, 0.5 - bias * 0.25) };
}

export default function SpinalKinematicsVisualizer() {
  const [flexion, setFlexion] = useState(0);
  const [lateral, setLateral] = useState(0);
  const { t, lang } = useLanguage();

  const legLabels: Record<string, string> = { LF: t("spk.legLF"), RF: t("spk.legRF"), LH: t("spk.legLH"), RH: t("spk.legRH") };
  const vertebrae = useMemo(() => computeVertebrae(flexion, lateral), [flexion, lateral]);
  const limbLoading = useMemo(() => computeLimbLoading(lateral), [lateral]);
  const hasStress = Math.abs(lateral) > 5 || Math.abs(flexion) > 8;
  const sidePath = vertebrae.map((v, i) => `${i === 0 ? "M" : "L"} ${v.x} ${v.y}`).join(" ");
  const topPath = vertebrae.map((v, i) => `${i === 0 ? "M" : "L"} ${v.topX} ${v.topY}`).join(" ");

  return (
    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-rubik flex items-center gap-2">
            {t("spk.title")}
            <Badge variant="outline" className="text-xs">22 {t("spk.vertebrae")}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("spk.subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                {t("spk.flexion")} <span className="text-xs text-muted-foreground">{flexion > 0 ? "+" : ""}{flexion}°</span>
              </label>
              <Slider value={[flexion]} onValueChange={([v]) => setFlexion(v)} min={-12} max={12} step={1} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                {t("spk.lateralRotation")} <span className="text-xs text-muted-foreground">{lateral > 0 ? "+" : ""}{lateral}°</span>
              </label>
              <Slider value={[lateral]} onValueChange={([v]) => setLateral(v)} min={-15} max={15} step={1} />
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("spk.sideView")}</h4>
            <svg viewBox="0 0 440 180" className="w-full h-auto bg-muted/20 rounded-lg">
              <path d={sidePath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeDasharray="4 2" opacity={0.3} />
              {vertebrae.map((v, i) => (
                <motion.circle key={i} cx={v.x} cy={v.y} r={i < THORACIC ? 6 : 7} fill={stressColor(v.stress)}
                  stroke="hsl(var(--border))" strokeWidth={1} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.02 }} />
              ))}
              <text x="40" y="170" fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">T1</text>
              <text x={40 + (THORACIC / (NUM_VERTEBRAE - 1)) * 360} y="170" fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">T18/L1</text>
              <text x="400" y="170" fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">L6</text>
              <circle cx="20" cy={vertebrae[0]?.y ?? 120} r="10" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity={0.4} />
              <text x="20" y={(vertebrae[0]?.y ?? 120) + 3} fill="hsl(var(--muted-foreground))" fontSize="7" textAnchor="middle">{t("spk.head")}</text>
              <text x="420" y={(vertebrae[NUM_VERTEBRAE - 1]?.y ?? 120) + 3} fill="hsl(var(--muted-foreground))" fontSize="7" textAnchor="middle">{t("spk.tail")}</text>
            </svg>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("spk.topView")}</h4>
            <svg viewBox="0 0 440 120" className="w-full h-auto bg-muted/20 rounded-lg">
              <line x1="40" y1="60" x2="400" y2="60" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
              <path d={topPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeDasharray="4 2" opacity={0.3} />
              {vertebrae.map((v, i) => (
                <motion.circle key={i} cx={v.topX} cy={v.topY} r={5} fill={stressColor(v.stress)}
                  stroke="hsl(var(--border))" strokeWidth={1} animate={{ cy: v.topY }} transition={{ type: "spring", stiffness: 300 }} />
              ))}
              <ellipse cx="220" cy="60" rx="190" ry="35" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity={0.2} />
              {[{ x: 80, y: 25, label: "RF" }, { x: 80, y: 95, label: "LF" }, { x: 360, y: 25, label: "RH" }, { x: 360, y: 95, label: "LH" }].map(leg => (
                <g key={leg.label}>
                  <circle cx={leg.x} cy={leg.y} r={8} fill={`hsl(var(--primary) / ${limbLoading[leg.label as keyof typeof limbLoading]})`} stroke="hsl(var(--primary))" strokeWidth={1.5} />
                  <text x={leg.x} y={leg.y + 3} fill="hsl(var(--primary-foreground))" fontSize="6" textAnchor="middle" fontWeight="bold">{Math.round(limbLoading[leg.label as keyof typeof limbLoading] * 100)}%</text>
                </g>
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {Object.entries(limbLoading).map(([leg, load]) => (
              <div key={leg} className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">{legLabels[leg]}</p>
                <p className={`text-lg font-bold ${load > 0.7 ? "text-destructive" : load > 0.5 ? "text-yellow-500" : "text-green-500"}`}>{Math.round(load * 100)}%</p>
              </div>
            ))}
          </div>

          {hasStress && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex items-start gap-2 bg-destructive/10 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">{t("spk.unbalanced")}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {Math.abs(lateral) > 5
                    ? t("spk.lateralStress").replace('{deg}', String(Math.abs(lateral))).replace('{side}', lateral > 0 ? (lang === 'en' ? 'left' : 'השמאלית') : (lang === 'en' ? 'right' : 'הימנית'))
                    : t("spk.flexionStress").replace('{deg}', String(Math.abs(flexion)))}
                </p>
              </div>
            </motion.div>
          )}

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>{t("spk.infoText")}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
