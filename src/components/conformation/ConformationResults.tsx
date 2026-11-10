import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, Star, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBar, MeasurementCard } from "./ConformationScoreCards";

export interface GaitSuitability {
  tolt: number;
  pace: number;
  foxTrot: number;
  runningWalk: number;
  pasoLlano: number;
}

export interface ConformationResult {
  shoulderAngle: number;
  shoulderAssessment: string;
  backRatio: string;
  backAssessment: string;
  croupSlope: number;
  croupAssessment: string;
  hindLegAngles: string;
  hindLegAssessment: string;
  neckSet: string;
  neckAssessment: string;
  overallBalance: number;
  overallAssessment: string;
  gaitSuitability: GaitSuitability;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  injuryRiskAreas: string[];
}

const gaitLabels: Record<keyof GaitSuitability, string> = {
  tolt: "טולט",
  pace: "פייס",
  foxTrot: "פוקס טרוט",
  runningWalk: "ראנינג ווק",
  pasoLlano: "פאסו יאנו",
};

function safeNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function computeSuitabilityScore(result: ConformationResult): number {
  const shoulder = safeNum(result.shoulderAngle, 47.5);
  const croup = safeNum(result.croupSlope, 20);
  const balance = safeNum(result.overallBalance, 50);

  const shoulderDist = Math.min(Math.abs(shoulder - 47.5), 15);
  const shoulderScore = Math.max(0, 100 - (shoulderDist / 15) * 100);

  const croupDist = Math.min(Math.abs(croup - 20), 15);
  const croupScore = Math.max(0, 100 - (croupDist / 15) * 100);

  return Math.round(shoulderScore * 0.35 + balance * 0.30 + croupScore * 0.35);
}

interface Props {
  result: ConformationResult;
  suitabilityScore: number;
}

export default function ConformationResults({ result, suitabilityScore }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Scores row */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">ציון איזון כללי</h2>
            <div className="text-5xl font-bold text-primary mb-2">{result.overallBalance}<span className="text-xl text-muted-foreground">/100</span></div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{result.overallAssessment}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">ציון התאמה לצעד מהיר</h2>
            <div className="text-5xl font-bold text-amber-500 mb-2">{suitabilityScore}<span className="text-xl text-muted-foreground">/100</span></div>
            <p className="text-sm text-muted-foreground">כתף 35% · גב 30% · אגן 35%</p>
          </CardContent>
        </Card>
      </div>

      {/* Measurements Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MeasurementCard title="זווית כתף" value={result.shoulderAngle} assessment={result.shoulderAssessment} icon={<span className="text-lg">📐</span>} />
        <MeasurementCard title="יחס אורך גב" value={result.backRatio} assessment={result.backAssessment} icon={<span className="text-lg">📏</span>} />
        <MeasurementCard title="שיפוע עכוז" value={result.croupSlope} assessment={result.croupAssessment} icon={<span className="text-lg">📊</span>} />
        <MeasurementCard title="זוויות רגליים אחוריות" value={result.hindLegAngles} assessment={result.hindLegAssessment} icon={<span className="text-lg">🦵</span>} />
        <MeasurementCard title="נשיאת צוואר" value={result.neckSet} assessment={result.neckAssessment} icon={<span className="text-lg">🦒</span>} />
      </div>

      {/* Gait Suitability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> התאמה לסוגי צעד</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(result.gaitSuitability).map(([key, score]) => (
            <ScoreBar key={key} score={score} label={gaitLabels[key as keyof GaitSuitability] || key} />
          ))}
        </CardContent>
      </Card>

      {/* Strengths & Weaknesses */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-green-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> נקודות חוזק</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" /> נקודות לשיפור</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.weaknesses.map((w, i) => (
                <li key={i} className="text-sm flex items-start gap-2"><span className="text-yellow-500 mt-0.5">⚠</span>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Injury Risk */}
      {result.injuryRiskAreas?.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-destructive" /> אזורי סיכון לפציעה</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {result.injuryRiskAreas.map((area, i) => (
                <li key={i} className="text-sm text-destructive/80">• {area}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendation */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">💡 המלצת המומחה</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.recommendation}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
