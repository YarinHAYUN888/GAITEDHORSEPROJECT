import { useState } from "react";
import { FileText, Loader2, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { callEdgeFunction } from "@/services/edgeFunctionClient";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  analysisId: string;
  horseId?: string;
}

export default function VetReportCard({ analysisId, horseId }: Props) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await callEdgeFunction<{ report: string }>("vet-report", { analysisId, horseId });
      setReport(data.report);
    } catch (e: any) {
      toast.error(e.message || "שגיאה ביצירת הדוח");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success("הדוח הועתק");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!report) {
    return (
      <Button onClick={generate} disabled={loading} variant="outline" size="sm" className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {loading ? "מייצר דוח..." : "דוח וטרינרי"}
      </Button>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          דוח לוקומוציה וטרינרי
          <Badge variant="outline" className="text-xs">AI</Badge>
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyToClipboard}>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="prose prose-sm dark:prose-invert max-w-none" dir="rtl">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
