import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Activity, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GaitAnalysisResult } from "@/types/gait";

function SharedContent() {
  const { token } = useParams<{ token: string }>();
  const { t, dir } = useLanguage();

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-analysis", token],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/gait_analyses?share_token=eq.${encodeURIComponent(token!)}&select=horse_name,gait_type,gait_type_hebrew,overall_score,symmetry_score,confidence,lateral_sync_pct,created_at,result_json,analysis_mode,beat_pattern&limit=1`,
        {
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Accept": "application/vnd.pgrst.object+json",
            "x-share-token": token!,
          },
        }
      );
      if (!res.ok) {
        if (res.status === 406) return null; // no rows
        throw new Error("Failed to fetch shared analysis");
      }
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4" dir={dir}>
        <Share2 className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">{t("share.notFound")}</h1>
        <p className="text-muted-foreground text-sm">{t("share.notFoundDesc")}</p>
      </div>
    );
  }

  const result = data.result_json as unknown as GaitAnalysisResult;
  const scoreColor = (data.overall_score ?? 0) >= 80
    ? "text-primary"
    : (data.overall_score ?? 0) >= 60
    ? "text-accent-foreground"
    : "text-destructive";

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <div className="bg-primary/5 border-b border-border py-6">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Share2 className="h-4 w-4" />
            {t("share.sharedResult")}
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            {data.horse_name || t("share.unnamedHorse")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(data.created_at).toLocaleDateString(dir === "rtl" ? "he-IL" : "en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Score card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${scoreColor}`}>{data.overall_score ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{t("share.overallScore")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{data.symmetry_score ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{t("share.symmetry")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{data.confidence ?? "—"}%</p>
              <p className="text-xs text-muted-foreground">{t("share.confidence")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{data.lateral_sync_pct != null ? `${data.lateral_sync_pct}%` : "—"}</p>
              <p className="text-xs text-muted-foreground">{t("share.sync")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("share.classification")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {data.gait_type && <Badge variant="secondary" className="text-sm">{data.gait_type}</Badge>}
              {data.gait_type_hebrew && data.gait_type_hebrew !== data.gait_type && (
                <Badge variant="outline" className="text-sm">{data.gait_type_hebrew}</Badge>
              )}
              {data.beat_pattern && <Badge variant="outline">{t("share.beat")}: {data.beat_pattern}</Badge>}
              {data.analysis_mode && <Badge variant="outline">{data.analysis_mode}</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {result?.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("share.summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {result?.trainingRecommendations && result.trainingRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("share.recommendations")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.trainingRecommendations.map((rec, i) => (
                  <li key={i}>{typeof rec === "string" ? rec : (rec as any)?.title ?? JSON.stringify(rec)}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          {t("share.poweredBy")}
        </div>
      </div>
    </div>
  );
}

export default function SharedAnalysis() {
  return (
    <LanguageProvider>
      <SharedContent />
    </LanguageProvider>
  );
}
