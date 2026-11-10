import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, TrendingUp, Award, Target, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { toast } from "@/components/ui/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/horse-progress-analysis`;

interface Props {
  horseId: string;
  horseName: string;
  analysisCount: number;
}

export default function HorseProgressAI({ horseId, horseName, analysisCount }: Props) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setAnalysis("");
    setHasRun(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ horseId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "שגיאה" }));
        if (resp.status === 429) {
          toast({ title: "הגבלת קצב — נסה שוב בעוד דקה", variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "נדרש תשלום — הוסף קרדיט", variant: "destructive" });
        } else {
          toast({ title: err.error || "שגיאה בניתוח", variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              result += content;
              setAnalysis(result);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "שגיאה בחיבור לשרת", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [horseId]);

  if (!hasRun) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">ניתוח AI מתקדם — {horseName}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {analysisCount > 0
                  ? `${analysisCount} ניתוחים זמינים — ה-AI ילמד את תבנית התנועה ויספק תובנות מותאמות`
                  : "אין עדיין ניתוחים — בצע ניתוח תנועה ראשון כדי להפעיל את המערכת"}
              </p>
            </div>
            {analysisCount > 0 && (
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="w-3 h-3" /> מגמת התקדמות
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Award className="w-3 h-3" /> ממצאים קינמטיים
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Target className="w-3 h-3" /> המלצות אימון
                </Badge>
              </div>
            )}
            <Button
              onClick={runAnalysis}
              disabled={analysisCount === 0}
              className="gap-2"
              size="lg"
            >
              <Sparkles className="w-4 h-4" />
              הפעל ניתוח AI
            </Button>
            {analysisCount === 0 && (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                העלה סרטון תנועה כדי להתחיל
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              ניתוח AI — {horseName}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={runAnalysis}
              disabled={loading}
              className="gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              רענן
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !analysis && (
            <div className="flex items-center justify-center py-8 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">מנתח את כל ההיסטוריה של {horseName}...</span>
            </div>
          )}
          {analysis && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground" dir="rtl">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
          {loading && analysis && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              ממשיך לנתח...
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
