import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PedigreeAnalysis() {
  const [pedigreeText, setPedigreeText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleAnalyze = async () => {
    if (!pedigreeText.trim()) return;
    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("pedigree-chat", {
        body: { pedigreeText: pedigreeText.trim() },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: t("ped.error"), description: data.error, variant: "destructive" });
        return;
      }

      setResult(data?.analysis || t("ped.noResult"));
    } catch (e: any) {
      console.error("Pedigree analysis error:", e);
      toast({ title: t("ped.error"), description: e.message || t("ped.errorDefault"), variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="py-12">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">{t("ped.title")}</h1>
          <p className="text-muted-foreground text-lg">{t("ped.subtitle")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-8">
          <label className="text-sm font-medium mb-2 block">{t("ped.label")}</label>
          <Textarea
            value={pedigreeText}
            onChange={(e) => setPedigreeText(e.target.value)}
            placeholder={t("ped.placeholder")}
            className="min-h-[200px] mb-4"
          />

          <Button onClick={handleAnalyze} disabled={!pedigreeText.trim() || isAnalyzing} className="w-full font-semibold">
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                {t("ped.analyzing")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 ml-2" />
                {t("ped.analyze")}
              </>
            )}
          </Button>

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-muted/50 rounded-lg p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
