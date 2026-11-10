import { useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Loader2, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useHorses } from "@/hooks/useHorses";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PredictiveTraining() {
  const { horses } = useHorses();
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [horseName, setHorseName] = useState("");
  const { t } = useLanguage();

  const handleGenerate = async () => {
    if (!selectedHorseId) { toast.error(t("train.selectFirst")); return; }
    setIsLoading(true);
    setPlan(null);
    try {
      const { data, error } = await supabase.functions.invoke("predictive-training", {
        body: { horseId: selectedHorseId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPlan(data.plan);
      setHorseName(data.horseName || "");
      toast.success(t("train.success"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("train.errorGeneric"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-12">
      <div className="container max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <Target className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">{t("train.title")}</h1>
          <p className="text-muted-foreground text-lg">{t("train.subtitle")}</p>
        </motion.div>

        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Dumbbell className="h-5 w-5 text-primary" />{t("train.selectHorse")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedHorseId} onValueChange={setSelectedHorseId}>
              <SelectTrigger className="min-h-[48px]"><SelectValue placeholder={t("train.selectPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {horses.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name} {h.breed_id ? `(${h.breed_id})` : ""} {h.dmrt3_genotype ? `— ${h.dmrt3_genotype}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={!selectedHorseId || isLoading} className="w-full min-h-[48px] text-base font-medium">
              {isLoading ? (<><Loader2 className="h-5 w-5 animate-spin ml-2" /> {t("train.generating")}</>) : (<><TrendingUp className="h-5 w-5 ml-2" /> {t("train.generate")}</>)}
            </Button>
            {horses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">{t("train.noHorses")}</p>
            )}
          </CardContent>
        </Card>

        {plan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass-card border-primary/20">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" />{t("train.planTitle").replace("{name}", horseName)}</CardTitle></CardHeader>
              <CardContent><div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{plan}</ReactMarkdown></div></CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
