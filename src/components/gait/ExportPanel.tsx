import { Download, FileJson, FileSpreadsheet, Database, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { downloadGaitPDF } from "@/lib/pdfReportGenerator";
import SendReportDialog from "@/components/gait/SendReportDialog";
import type { EnrichedGaitResult } from "@/types/gait";

interface ExportPanelProps {
  result: EnrichedGaitResult;
  horseName?: string;
  analysisId?: string;
}

const EXPORT_SCHEMA_VERSION = "2.0.0";

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({ result, horseName, analysisId }: ExportPanelProps) {
  const { t, lang } = useLanguage();

  const exportPDF = () => {
    try {
      downloadGaitPDF({ result, horseName, lang });
      toast.success(t("export.pdfSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("export.error"));
    }
  };

  const exportJSON = () => {
    const payload = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      horseName,
      gaitType: result.gaitType,
      overallScore: result.overallScore,
      confidence: result.confidence,
      outcome: result.decision?.outcome,
      reasonCodes: result.decision?.reasonCodes,
      decisionTrace: result.decisionTrace,
      qualitySealLevel: result.qualitySealLevel,
      qualitySealScore: result.qualitySealScore,
      explainability: result.explainability,
      biomechMetrics: result.biomechMetrics,
      kinematicMetrics: result.kinematicMetrics,
      audioAnalysis: result.audioAnalysis,
      multiModalFusion: result.multiModalFusion,
      conditions: result.conditions,
      summary: result.summary,
    };
    downloadBlob(JSON.stringify(payload, null, 2), `gait-export-${horseName || "analysis"}.json`, "application/json");
    toast.success(t("export.jsonSuccess"));
  };

  const exportContactCSV = () => {
    const contacts = result.biomechMetrics?.contactEvents;
    if (!contacts) { toast.error(t("export.noData")); return; }
    const rows = ["time,leg,confidence,frameIndex"];
    for (const [leg, events] of Object.entries(contacts)) {
      for (const e of events) {
        rows.push(`${e.t.toFixed(4)},${leg},${e.confidence.toFixed(3)},${e.frameIndex}`);
      }
    }
    downloadBlob(rows.join("\n"), `contacts-${horseName || "analysis"}.csv`, "text/csv");
    toast.success(t("export.csvSuccess"));
  };

  const exportWindowCSV = () => {
    const windows = result.biomechMetrics?.windows;
    if (!windows || windows.length === 0) { toast.error(t("export.noData")); return; }
    const first = windows[0].features;
    const keys = Object.keys(first);
    const rows = ["windowIndex,quality," + keys.join(",")];
    windows.forEach((w, i) => {
      const vals = keys.map(k => (w.features as any)[k] ?? "");
      rows.push(`${i},${w.quality.toFixed(3)},${vals.join(",")}`);
    });
    downloadBlob(rows.join("\n"), `windows-${horseName || "analysis"}.csv`, "text/csv");
    toast.success(t("export.csvSuccess"));
  };

  const exportGroundTruth = async () => {
    try {
      const { data: votes } = await (supabase.from("gait_label_votes" as any) as any).select("*").order("created_at", { ascending: true });
      const { data: consensusData } = await (supabase.from("gait_label_consensus" as any) as any).select("*");

      if (!votes || votes.length === 0) {
        toast.error(t("export.noData"));
        return;
      }

      const lines = votes.map((v: any) => JSON.stringify({
        annotationId: v.id,
        analysisId: v.analysis_id,
        clipId: v.clip_id,
        label: v.label,
        labelConfidence: v.confidence,
        alternatives: v.alternatives,
        tags: v.tags,
        notes: v.notes,
        captureMeta: v.capture_meta,
        annotator: { userId: v.annotator_id, role: v.annotator_role },
        createdAt: v.created_at,
      }));

      if (consensusData && consensusData.length > 0) {
        lines.push("");
        for (const c of consensusData) {
          lines.push(JSON.stringify({
            _type: "consensus",
            analysisId: c.analysis_id,
            finalLabel: c.final_label,
            method: c.method,
            agreement: c.agreement,
            labelStats: c.label_stats,
            createdAt: c.created_at,
          }));
        }
      }

      downloadBlob(lines.join("\n"), `ground-truth-${new Date().toISOString().slice(0, 10)}.jsonl`, "application/jsonl");
      toast.success(t("export.groundTruthSuccess"));
    } catch {
      toast.error(t("export.error"));
    }
  };

  return (
    <Card className="glass-card border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          {t("export.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={exportPDF} className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            {t("export.pdf")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportJSON} className="gap-2">
            <FileJson className="h-3.5 w-3.5" />
            {t("export.json")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportContactCSV} className="gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t("export.contactsCsv")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportWindowCSV} className="gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t("export.windowsCsv")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportGroundTruth} className="gap-2">
            <Database className="h-3.5 w-3.5" />
            {t("export.groundTruth")}
          </Button>
          <SendReportDialog analysisId={analysisId} horseName={horseName} />
        </div>
      </CardContent>
    </Card>
  );
}
