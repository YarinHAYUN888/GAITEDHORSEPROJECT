import { useState } from "react";
import { motion } from "framer-motion";
import { Dna, Shuffle, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { breeds } from "@/data/breeds";

type Genotype = "AA" | "CA" | "CC";

interface PunnettResult {
  AA: number;
  CA: number;
  CC: number;
}

const calculatePunnett = (sire: Genotype, dam: Genotype): PunnettResult => {
  const map: Record<string, PunnettResult> = {
    "AA-AA": { AA: 100, CA: 0, CC: 0 },
    "AA-CA": { AA: 50, CA: 50, CC: 0 },
    "AA-CC": { AA: 0, CA: 100, CC: 0 },
    "CA-AA": { AA: 50, CA: 50, CC: 0 },
    "CA-CA": { AA: 25, CA: 50, CC: 25 },
    "CA-CC": { AA: 0, CA: 50, CC: 50 },
    "CC-AA": { AA: 0, CA: 100, CC: 0 },
    "CC-CA": { AA: 0, CA: 50, CC: 50 },
    "CC-CC": { AA: 0, CA: 0, CC: 100 },
  };
  return map[`${sire}-${dam}`];
};

const genotypeColors: Record<Genotype, string> = {
  AA: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CA: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  CC: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const gaitProbabilities: Record<string, Record<string, number>> = {
  AA: { "Speed Pace / Andadura": 40, "Tölt / Running Walk": 35, "Flat Walk": 20, "Trot hybrid": 5 },
  CA: { "Speed Pace / Andadura": 10, "Tölt / Running Walk": 30, "Flat Walk": 30, "Trot hybrid": 30 },
  CC: { "Speed Pace / Andadura": 0, "Tölt / Running Walk": 5, "Flat Walk": 25, "Trot hybrid": 70 },
};

export default function BreedingSimulator() {
  const [sireName, setSireName] = useState("");
  const [damName, setDamName] = useState("");
  const [sireGenotype, setSireGenotype] = useState<Genotype | "">("");
  const [damGenotype, setDamGenotype] = useState<Genotype | "">("");
  const [sireBreed, setSireBreed] = useState("");
  const [damBreed, setDamBreed] = useState("");
  const [punnettResult, setPunnettResult] = useState<PunnettResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSimulate = () => {
    if (!sireGenotype || !damGenotype) return;
    setPunnettResult(calculatePunnett(sireGenotype, damGenotype));
    setAiAnalysis(null);
  };

  const handleAiSimulation = async () => {
    if (!sireGenotype || !damGenotype) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("expert-analysis", {
        body: {
          type: "expert",
          result: {
            breedingSimulation: true,
            sire: { name: sireName || "לא ידוע", genotype: sireGenotype, breed: sireBreed || "לא ידוע" },
            dam: { name: damName || "לא ידוע", genotype: damGenotype, breed: damBreed || "לא ידוע" },
            punnett: calculatePunnett(sireGenotype, damGenotype),
            gaitProbabilities: {
              AA: gaitProbabilities.AA,
              CA: gaitProbabilities.CA,
              CC: gaitProbabilities.CC,
            },
          },
          horseName: `${sireName || "אב"} × ${damName || "אם"}`,
        },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "שגיאה", description: data.error, variant: "destructive" }); return; }
      setAiAnalysis(data?.analysis || "");
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message || "שגיאה בסימולציה", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const weightedGaitProbs = punnettResult ? Object.entries(gaitProbabilities).reduce<Record<string, number>>((acc, [geno, probs]) => {
    const genoWeight = punnettResult[geno as Genotype] / 100;
    Object.entries(probs).forEach(([gait, prob]) => {
      acc[gait] = (acc[gait] || 0) + prob * genoWeight;
    });
    return acc;
  }, {}) : null;

  return (
    <div className="py-12">
      <div className="container max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <Shuffle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">סימולטור הרבעות</h1>
          <p className="text-muted-foreground text-lg">חזו את הפוטנציאל הגנטי של הצאצאים עם סימולציית DMRT3</p>
        </motion.div>

        <div className="glass-card p-8 space-y-8">
          {/* Parents Input */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Sire */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Dna className="h-5 w-5 text-primary" /> האב
              </h3>
              <Input value={sireName} onChange={(e) => setSireName(e.target.value)} placeholder="שם האב" />
              <Select value={sireGenotype} onValueChange={(v) => setSireGenotype(v as Genotype)}>
                <SelectTrigger><SelectValue placeholder="גנוטיפ DMRT3" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AA">AA — הומוזיגוט מוטנטי</SelectItem>
                  <SelectItem value="CA">CA — הטרוזיגוט</SelectItem>
                  <SelectItem value="CC">CC — הומוזיגוט תקין</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sireBreed} onValueChange={setSireBreed}>
                <SelectTrigger><SelectValue placeholder="גזע (אופציונלי)" /></SelectTrigger>
                <SelectContent>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nameHe}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dam */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Dna className="h-5 w-5 text-primary" /> האם
              </h3>
              <Input value={damName} onChange={(e) => setDamName(e.target.value)} placeholder="שם האם" />
              <Select value={damGenotype} onValueChange={(v) => setDamGenotype(v as Genotype)}>
                <SelectTrigger><SelectValue placeholder="גנוטיפ DMRT3" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AA">AA — הומוזיגוט מוטנטי</SelectItem>
                  <SelectItem value="CA">CA — הטרוזיגוט</SelectItem>
                  <SelectItem value="CC">CC — הומוזיגוט תקין</SelectItem>
                </SelectContent>
              </Select>
              <Select value={damBreed} onValueChange={setDamBreed}>
                <SelectTrigger><SelectValue placeholder="גזע (אופציונלי)" /></SelectTrigger>
                <SelectContent>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nameHe}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSimulate} disabled={!sireGenotype || !damGenotype} className="flex-1 h-12 font-semibold">
              <Shuffle className="h-4 w-4 ml-2" />
              חשבו הסתברות
            </Button>
            {punnettResult && (
              <Button onClick={handleAiSimulation} disabled={isLoading} variant="outline" className="h-12">
                {isLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <TrendingUp className="h-4 w-4 ml-2" />}
                ניתוח AI מעמיק
              </Button>
            )}
          </div>

          {/* Results */}
          {punnettResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Punnett Results */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">הסתברות גנוטיפ DMRT3</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(["AA", "CA", "CC"] as Genotype[]).map((g) => (
                    <div key={g} className="flex items-center gap-3">
                      <Badge variant="outline" className={`min-w-[50px] justify-center ${genotypeColors[g]}`}>{g}</Badge>
                      <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${punnettResult[g]}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-primary/70 rounded-full flex items-center justify-end px-3"
                        >
                          {punnettResult[g] > 10 && <span className="text-xs font-bold text-primary-foreground">{punnettResult[g]}%</span>}
                        </motion.div>
                      </div>
                      {punnettResult[g] <= 10 && <span className="text-sm text-muted-foreground">{punnettResult[g]}%</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Gait Probabilities */}
              {weightedGaitProbs && (
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">הסתברות סוג צעד לצאצא</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(weightedGaitProbs).sort((a, b) => b[1] - a[1]).map(([gait, prob]) => (
                      <div key={gait} className="flex items-center gap-3">
                        <span className="text-sm min-w-[160px]">{gait}</span>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${prob}%` }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className={`h-full rounded-full ${prob > 30 ? "bg-emerald-500/70" : prob > 15 ? "bg-amber-500/70" : "bg-slate-500/50"}`}
                          />
                        </div>
                        <span className="text-sm font-bold min-w-[45px] text-end">{Math.round(prob)}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Inbreeding Warning */}
              {sireBreed && damBreed && sireBreed === damBreed && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">זיווג בתוך אותו גזע</p>
                    <p className="text-xs text-destructive/80">שימו לב לקרבת דם פוטנציאלית. מומלץ לבדוק תעודות יוחסין לפני הזיווג.</p>
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              {aiAnalysis && (
                <Card className="glass-card border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      ניתוח AI מעמיק
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
