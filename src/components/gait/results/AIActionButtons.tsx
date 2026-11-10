import { useState, useCallback, lazy, Suspense } from "react";
import { Loader2, Brain, Dumbbell, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchExpertAnalysis, fetchTrainingPlan, generateReport } from "@/services/expertService";
import type { GaitAnalysisResult } from "@/types/gait";
import { useLanguage } from "@/contexts/LanguageContext";

const ReactMarkdown = lazy(() => import("react-markdown"));

function LazyFallback() {
  return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}

function MarkdownCard({ title, icon: Icon, content }: { title: string; icon: any; content: string }) {
  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Suspense fallback={<LazyFallback />}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </Suspense>
        </div>
      </CardContent>
    </Card>
  );
}

interface AIActionButtonsProps {
  result: GaitAnalysisResult;
  horseName?: string;
}

export default function AIActionButtons({ result, horseName }: AIActionButtonsProps) {
  const [expertAnalysis, setExpertAnalysis] = useState<string | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<string | null>(null);
  const [isExpertLoading, setIsExpertLoading] = useState(false);
  const [isTrainingLoading, setIsTrainingLoading] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleExpertAnalysis = useCallback(async () => {
    setIsExpertLoading(true);
    try {
      const analysis = await fetchExpertAnalysis(result, horseName);
      setExpertAnalysis(analysis);
    } catch (e: any) {
      toast({ title: t("ai.errorTitle"), description: e.message || t("ai.expertError"), variant: "destructive" });
    } finally {
      setIsExpertLoading(false);
    }
  }, [result, horseName, toast, t]);

  const handleTrainingPlan = useCallback(async () => {
    setIsTrainingLoading(true);
    try {
      const plan = await fetchTrainingPlan(result, horseName);
      setTrainingPlan(plan);
    } catch (e: any) {
      toast({ title: t("ai.errorTitle"), description: e.message || t("ai.trainingError"), variant: "destructive" });
    } finally {
      setIsTrainingLoading(false);
    }
  }, [result, horseName, toast, t]);

  const handleGenerateReport = useCallback(async () => {
    setIsReportLoading(true);
    try {
      const report = await generateReport(result, horseName);
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gait-report-${horseName || "analysis"}-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("ai.reportSuccessTitle"), description: t("ai.reportSuccessDesc") });
    } catch (e: any) {
      toast({ title: t("ai.errorTitle"), description: e.message || t("ai.reportError"), variant: "destructive" });
    } finally {
      setIsReportLoading(false);
    }
  }, [result, horseName, toast, t]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button onClick={handleExpertAnalysis} disabled={isExpertLoading} variant="outline" className="h-12">
          {isExpertLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Brain className="h-4 w-4 ml-2" />}
          {t("ai.expertBtn")}
        </Button>
        <Button onClick={handleTrainingPlan} disabled={isTrainingLoading} variant="outline" className="h-12">
          {isTrainingLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Dumbbell className="h-4 w-4 ml-2" />}
          {t("ai.trainingBtn")}
        </Button>
        <Button onClick={handleGenerateReport} disabled={isReportLoading} variant="outline" className="h-12">
          {isReportLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <FileText className="h-4 w-4 ml-2" />}
          {t("ai.reportBtn")}
        </Button>
      </div>

      {expertAnalysis && <MarkdownCard title={t("ai.expertTitle")} icon={Brain} content={expertAnalysis} />}
      {trainingPlan && <MarkdownCard title={t("ai.trainingTitle")} icon={Dumbbell} content={trainingPlan} />}
    </>
  );
}
