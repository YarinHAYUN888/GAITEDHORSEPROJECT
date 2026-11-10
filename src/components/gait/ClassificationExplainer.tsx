import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { GaitClassification } from "@/types/biomech";
import type { ExplainItem } from "@/types/pipeline";

interface ClassificationExplainerProps {
  classification: GaitClassification;
  criticWarnings?: string[];
  detailLevel?: "beginner" | "advanced" | "coach";
  evidenceFor?: ExplainItem[];
  evidenceAgainst?: ExplainItem[];
}

const GAIT_NAMES: Record<string, string> = {
  diagonal: "טרוט (Diagonal)",
  lateral: "פייס (Lateral/Pace)",
  singlefoot: "סינגלפוט (Singlefoot)",
  four_beat: "4-פעימות (Four Beat)",
  broken_pace: "פייס שבור (Broken Pace)",
  inconclusive: "לא חד-משמעי (Inconclusive)",
  unknown: "לא מזוהה",
};

export default memo(function ClassificationExplainer({ classification, criticWarnings, detailLevel = "advanced", evidenceFor, evidenceAgainst }: ClassificationExplainerProps) {
  const { classificationReason, alternatives, confidence, breedPriorDelta } = classification;
  const isInconclusive = classification.classification === "inconclusive";

  if (!classificationReason && !alternatives?.length && !criticWarnings?.length && !isInconclusive && !evidenceFor?.length) return null;

  const confPct = (confidence * 100).toFixed(0);

  return (
    <Card className={`glass-card ${isInconclusive ? "border-yellow-500/30 bg-yellow-500/5" : "border-primary/10"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <HelpCircle className={`h-4 w-4 ${isInconclusive ? "text-yellow-500" : "text-primary"}`} />
          {isInconclusive ? "סיווג לא חד-משמעי" : "למה סיווג כך?"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Inconclusive explanation */}
        {isInconclusive && alternatives && alternatives.length > 0 && (
          <div className="space-y-2 p-2 rounded-lg bg-yellow-500/10">
            <p className="text-foreground leading-relaxed">
              הנתונים איכותיים, אך קיימת אי-ודאות בין שני סוגי צעד:
            </p>
            <div className="flex flex-wrap gap-2">
              {alternatives.slice(0, 2).map((alt, i) => (
                <Badge key={i} variant="outline" className="text-xs gap-1 border-yellow-500/40">
                  {GAIT_NAMES[alt.classification] || alt.classification}
                  <span className="font-mono text-muted-foreground">({(alt.score * 100).toFixed(0)}%)</span>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              מומלץ לצלם שוב מזווית צד או להתייעץ עם מומחה.
            </p>
          </div>
        )}

        {/* Main reason */}
        {classificationReason && !isInconclusive && (
          <div className="space-y-1">
            <p className="text-foreground leading-relaxed">
              <span className="font-semibold">{GAIT_NAMES[classification.classification] || classification.classification}</span>
              {" כי: "}
              <span className="text-muted-foreground">{classificationReason}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              ביטחון: <span className="font-mono font-semibold text-foreground">{confPct}%</span>
            </p>
          </div>
        )}

        {/* Breed prior — coach mode only */}
        {detailLevel === "coach" && breedPriorDelta !== undefined && breedPriorDelta > 0 && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Breed prior applied (+{breedPriorDelta.toFixed(2)})
          </Badge>
        )}

        {/* Evidence FOR — advanced+ */}
        {detailLevel !== "beginner" && evidenceFor && evidenceFor.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              תומך בסיווג:
            </p>
            <ul className="space-y-0.5">
              {evidenceFor.map((e, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {e.reason}
                  {e.windowIndex !== undefined && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">חלון #{e.windowIndex}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Evidence AGAINST — advanced+ */}
        {detailLevel !== "beginner" && evidenceAgainst && evidenceAgainst.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              נגד הסיווג:
            </p>
            <ul className="space-y-0.5">
              {evidenceAgainst.map((e, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-destructive mt-0.5">✗</span>
                  {e.reason}
                  {e.windowIndex !== undefined && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">חלון #{e.windowIndex}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Alternatives */}
        {alternatives && alternatives.length > 0 && !isInconclusive && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">חלופות אפשריות:</p>
            <div className="flex flex-wrap gap-2">
              {alternatives.map((alt, i) => (
                <Badge key={i} variant="outline" className="text-xs gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {GAIT_NAMES[alt.classification] || alt.classification}
                  <span className="font-mono text-muted-foreground">({(alt.score * 100).toFixed(0)}%)</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Critic warnings */}
        {criticWarnings && criticWarnings.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              אזהרות בקרת איכות:
            </p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {criticWarnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-destructive mt-0.5">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
