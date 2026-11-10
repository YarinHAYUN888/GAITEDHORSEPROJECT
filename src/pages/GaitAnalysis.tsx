import { useState, useEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Video, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GaitAnalysisHistory from "@/components/gait/GaitAnalysisHistory";
import GaitComparisonView from "@/components/gait/GaitComparisonView";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import UploadFlow from "@/components/gait/UploadFlow";
import CreditBadge from "@/components/gait/CreditBadge";
import type { GaitAnalysisResult, EnrichedGaitResult } from "@/types/gait";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getCredits } from "@/services/creditService";
import type { CreditTier } from "@/types/pipeline";

const AccuracyDashboard = lazy(() => import("@/components/gait/AccuracyDashboard"));
const PipelineHealthDashboard = lazy(() => import("@/components/gait/PipelineHealthDashboard"));
const SelfTestDashboard = lazy(() => import("@/components/gait/SelfTestDashboard"));

// Re-export types for backward compatibility
export type { GaitAnalysisResult, KinematicMetrics, SuspensionAnalysis, AudioAnalysis, MultiModalFusion } from "@/types/gait";

export default function GaitAnalysis() {
  const { t, dir, lang } = useLanguage();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userTier, setUserTier] = useState<CreditTier>("free");
  const [activeTab, setActiveTab] = useState("new");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [analysisMode, setAnalysisMode] = useState<"vision" | "audio" | "both">("both");

  // External result from history view
  const [externalResult, setExternalResult] = useState<EnrichedGaitResult | null>(null);
  const [externalHorseName, setExternalHorseName] = useState<string | undefined>();
  const [externalAnalysisId, setExternalAnalysisId] = useState<string | null>(null);

  // Comparison state
  const [referenceResult, setReferenceResult] = useState<{ result: GaitAnalysisResult; date?: string } | null>(null);
  const [comparisonResult, setComparisonResult] = useState<{ result: GaitAnalysisResult; date?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as const }).then(({ data }) => {
      setIsAdmin(!!data);
    });
    getCredits(user.id).then(credits => setUserTier(credits.tier as CreditTier)).catch(() => {});
  }, [user]);

  const handleViewHistoryRecord = (r: GaitAnalysisResult, id?: string, _validated?: boolean, horseName?: string) => {
    setExternalHorseName(horseName);
    setExternalResult(r as EnrichedGaitResult);
    setExternalAnalysisId(id || null);
    setActiveTab("new");
  };

  const handleCompare = (r: GaitAnalysisResult, date?: string) => {
    if (!referenceResult) {
      setReferenceResult({ result: r, date });
      toast.info(t("gait.compareSelected"));
    } else {
      setComparisonResult({ result: r, date });
      setActiveTab("compare");
    }
  };

  const clearComparison = () => {
    setReferenceResult(null);
    setComparisonResult(null);
  };

  const AdminFallback = (
    <div className="flex justify-center py-12"><Activity className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="py-6">
      <div className="container max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border pb-6 space-y-3">
          <Button asChild variant="link" className="px-0 min-h-11"><Link to="/dashboard">{lang === "he" ? "הסוסים שלי" : "My horses"}</Link></Button>
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl sm:text-3xl font-rubik font-bold">{t("gait.title")}</h1><CreditBadge /></div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); if (tab === "new") { setExternalResult(null); setExternalAnalysisId(null); } }} dir={dir} className="mt-8">
          <TabsList className="w-full flex justify-start overflow-x-auto h-auto">
            <TabsTrigger className="min-h-11 shrink-0" value="new">{t("gait.tabNew")}</TabsTrigger>
            <TabsTrigger className="min-h-11 shrink-0" value="history">{t("gait.tabHistory")}</TabsTrigger>
            <TabsTrigger className="min-h-11 shrink-0" value="compare" disabled={!referenceResult || !comparisonResult}>{t("gait.tabCompare")}</TabsTrigger>
            {isAdmin && <TabsTrigger className="min-h-11 shrink-0" value="credits">{lang === "he" ? "קרדיטים" : "Credits"}</TabsTrigger>}
            {isAdmin && <TabsTrigger className="min-h-11 shrink-0" value="accuracy">{t("gait.tabAccuracy")}</TabsTrigger>}
            {isAdmin && <TabsTrigger className="min-h-11 shrink-0" value="pipeline">{t("gait.tabPipeline")}</TabsTrigger>}
            {isAdmin && <TabsTrigger className="min-h-11 shrink-0" value="selftest">Self-Test</TabsTrigger>}
          </TabsList>

          <TabsContent value="new">
            <UploadFlow
              userTier={userTier}
              onAnalysisComplete={() => setHistoryRefresh((k) => k + 1)}
              externalResult={externalResult}
              externalAnalysisId={externalAnalysisId}
              externalHorseName={externalHorseName}
              onNewAnalysis={() => { setExternalResult(null); setExternalAnalysisId(null); }}
              analysisMode={analysisMode}
              setAnalysisMode={setAnalysisMode}
            />
          </TabsContent>

          <TabsContent value="history">
            <GaitAnalysisHistory
              refreshKey={historyRefresh}
              onViewRecord={handleViewHistoryRecord}
              onCompare={handleCompare}
            />
          </TabsContent>

          <TabsContent value="compare">
            {referenceResult && comparisonResult ? (
              <div className="space-y-4">
                <GaitComparisonView
                  reference={referenceResult.result}
                  current={comparisonResult.result}
                  referenceDate={referenceResult.date}
                  currentDate={comparisonResult.date}
                />
                <Button variant="outline" onClick={clearComparison} className="w-full">{t("gait.clearComparison")}</Button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">{t("gait.compareHelp")}</div>
            )}
          </TabsContent>

          {isAdmin && <TabsContent value="credits"><Button asChild variant="outline"><Link to="/admin">{lang === "he" ? "ניהול משתמשים וקרדיטים" : "Manage users and credits"}</Link></Button></TabsContent>}
          {isAdmin && <TabsContent value="accuracy"><Suspense fallback={AdminFallback}><AccuracyDashboard /></Suspense></TabsContent>}
          {isAdmin && <TabsContent value="pipeline"><Suspense fallback={AdminFallback}><PipelineHealthDashboard /></Suspense></TabsContent>}
          {isAdmin && <TabsContent value="selftest"><Suspense fallback={AdminFallback}><SelfTestDashboard /></Suspense></TabsContent>}
        </Tabs>
      </div>
    </div>
  );
}
