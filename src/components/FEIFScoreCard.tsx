import { motion } from "framer-motion";
import { Award, AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { type FEIFScoreResult, FEIF_TESTS } from "@/data/feifStandards";

const gradeColors: Record<string, string> = {
  excellent: "text-green-500",
  good: "text-blue-400",
  fair: "text-yellow-500",
  poor: "text-destructive",
};

const gradeLabels: Record<string, string> = {
  excellent: "מעולה",
  good: "טוב",
  fair: "סביר",
  poor: "חלש",
};

interface FEIFScoreCardProps {
  scores: FEIFScoreResult[];
}

export default function FEIFScoreCard({ scores }: FEIFScoreCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!scores.length) return null;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          מיפוי FEIF — סטנדרט תחרותי בינלאומי
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={scores[0].testId}>
          <TabsList className="w-full justify-start mb-3">
            {scores.map(s => (
              <TabsTrigger key={s.testId} value={s.testId} className="text-xs">
                {s.testNameHe}
              </TabsTrigger>
            ))}
          </TabsList>

          {scores.map(score => {
            const test = FEIF_TESTS.find(t => t.id === score.testId);
            return (
              <TabsContent key={score.testId} value={score.testId} className="space-y-4">
                {/* Total Score */}
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-full border-4 border-primary/30 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">{score.totalScore}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">ציון כולל FEIF</p>
                    <p className="text-xs text-muted-foreground">{test?.description}</p>
                  </div>
                </div>

                {/* Criterion Bars */}
                <div className="space-y-3">
                  {score.criterionScores.map(c => (
                    <div key={c.criterionId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{c.nameHe} ({Math.round(c.weight * 100)}%)</span>
                        <span className={`font-bold ${gradeColors[c.grade]}`}>
                          {c.score}/10 — {gradeLabels[c.grade]}
                        </span>
                      </div>
                      <Progress value={c.score * 10} className="h-2" />
                    </div>
                  ))}
                </div>

                {/* Warnings */}
                {score.warnings.length > 0 && (
                  <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full text-yellow-500 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 ml-1" />
                        {score.warnings.length} אזהרות תחרותיות
                        <ChevronDown className={`h-3.5 w-3.5 mr-auto transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="space-y-1 pt-1">
                        {score.warnings.map((w, i) => (
                          <li key={i} className="text-xs text-yellow-500 flex items-start gap-1.5">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
