import { motion } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface QualitySealData {
  visionAudioAgreement: boolean;
  fusedConfidence: number;
  calibrationConfidence: number;
  rhythmRegularity: number;
  symmetryScore: number;
  captureQualityScore: number; // 0-4
  hrRecovery?: { bpm: number; isHealthy: boolean } | null;
  windowQualityAvg?: number; // 0-100 computed from pipeline
  occlusionRate?: number; // 0-1 avg across keypoints
}

interface QualitySealProps {
  data: QualitySealData;
}

export function computeSealLevel(data: QualitySealData): { level: "gold" | "silver" | "bronze" | "none"; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Cross-modal agreement (30 points)
  if (data.visionAudioAgreement && data.fusedConfidence >= 80) {
    score += 30;
  } else if (data.visionAudioAgreement) {
    score += 20;
  } else {
    reasons.push("סתירה בין ויז'ן לאודיו");
  }

  // Calibration (20 points)
  if (data.calibrationConfidence >= 70) {
    score += 20;
  } else if (data.calibrationConfidence >= 40) {
    score += 10;
    reasons.push("כיול חלקי בלבד");
  } else {
    reasons.push("ללא כיול — מדידות יחסיות בלבד");
  }

  // Rhythm regularity (20 points)
  if (data.rhythmRegularity >= 90) score += 20;
  else if (data.rhythmRegularity >= 75) score += 12;
  else reasons.push("סדירות קצב נמוכה");

  // Symmetry (15 points)
  if (data.symmetryScore >= 90) score += 15;
  else if (data.symmetryScore >= 75) score += 8;
  else reasons.push("סימטריה נמוכה");

  // Capture quality (15 points) — use windowQualityAvg if available for finer granularity
  if (data.windowQualityAvg !== undefined) {
    if (data.windowQualityAvg >= 70) score += 15;
    else if (data.windowQualityAvg >= 50) score += 10;
    else if (data.windowQualityAvg >= 30) score += 5;
    else reasons.push("איכות חלונות ניתוח נמוכה");
  } else {
    if (data.captureQualityScore >= 4) score += 15;
    else if (data.captureQualityScore >= 3) score += 10;
    else reasons.push("איכות צילום לא מיטבית");
  }

  // Occlusion penalty (deduct up to 10 points)
  if (data.occlusionRate !== undefined && data.occlusionRate > 0.2) {
    const penalty = Math.min(10, Math.round(data.occlusionRate * 15));
    score -= penalty;
    if (data.occlusionRate > 0.35) reasons.push("אחוז חסימה גבוה של נקודות מפתח");
  }

  const level = score >= 85 ? "gold" : score >= 65 ? "silver" : score >= 45 ? "bronze" : "none";
  return { level, score, reasons };
}

const sealConfig = {
  gold: { label: "תו איכות זהב", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: ShieldCheck },
  silver: { label: "תו איכות כסף", color: "text-slate-300", bg: "bg-slate-400/10 border-slate-400/30", icon: ShieldCheck },
  bronze: { label: "תו איכות ארד", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", icon: Shield },
  none: { label: "לא עומד בתקן", color: "text-muted-foreground", bg: "bg-muted/30 border-border", icon: ShieldAlert },
};

export default function QualitySeal({ data }: QualitySealProps) {
  const { level, score, reasons } = computeSealLevel(data);
  const config = sealConfig[level];
  const Icon = config.icon;

  return (
    <Card className={`glass-card border ${config.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color}`} />
          חותמת אמינות — Quality Seal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4 }}
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${config.bg}`}
          >
            <Icon className={`h-8 w-8 ${config.color}`} />
          </motion.div>
          <div>
            <p className={`text-lg font-bold ${config.color}`}>{config.label}</p>
            <p className="text-xs text-muted-foreground">ציון אמינות: {score}/100</p>
          </div>
          <Badge variant="outline" className={`mr-auto ${config.color}`}>{score}%</Badge>
        </div>

        {reasons.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">נקודות לשיפור:</p>
            {reasons.map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {r}</p>
            ))}
          </div>
        )}

        {/* HR Recovery */}
        {data.hrRecovery && (
          <div className={`flex items-center gap-2 p-2 rounded-lg ${data.hrRecovery.isHealthy ? "bg-green-500/10" : "bg-destructive/10"}`}>
            <Heart className={`h-4 w-4 ${data.hrRecovery.isHealthy ? "text-green-500" : "text-destructive"}`} />
            <span className="text-xs">
              דופק: {data.hrRecovery.bpm} BPM — {data.hrRecovery.isHealthy ? "בטווח בריא (< 64 BPM)" : "מעל סף FEI (64 BPM)"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
