import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, Dna, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Genotype = "AA" | "CA" | "CC";

interface Result {
  AA: number;
  CA: number;
  CC: number;
}

const calculateOffspring = (sire: Genotype, dam: Genotype): Result => {
  const map: Record<string, Result> = {
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

const genotypeInfo: Record<Genotype, { label: string; color: string; desc: string }> = {
  AA: { label: "הומוזיגוטי (AA)", color: "bg-emerald-500/15 text-emerald-400", desc: "צעד טבעי חזק" },
  CA: { label: "הטרוזיגוטי (CA)", color: "bg-amber-500/15 text-amber-400", desc: "ורסטילי" },
  CC: { label: "ללא מוטציה (CC)", color: "bg-slate-500/15 text-slate-400", desc: "טרוט/דהירה" },
};

export default function GeneticCalculator() {
  const [sire, setSire] = useState<Genotype | "">("");
  const [dam, setDam] = useState<Genotype | "">("");
  const [result, setResult] = useState<Result | null>(null);

  const handleCalculate = () => {
    if (sire && dam) {
      setResult(calculateOffspring(sire as Genotype, dam as Genotype));
    }
  };

  return (
    <div className="py-12">
      <div className="container max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <Calculator className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">מחשבון גנטי DMRT3</h1>
          <p className="text-muted-foreground text-lg">חשבו את ההסתברות הגנטית של הצאצאים</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {/* Sire */}
            <div>
              <label className="text-sm font-medium mb-2 block">גנוטיפ האב</label>
              <Select value={sire} onValueChange={(v) => setSire(v as Genotype)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחרו גנוטיפ" />
                </SelectTrigger>
                <SelectContent>
                  {(["AA", "CA", "CC"] as Genotype[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      <span className="flex items-center gap-2">
                        <Dna className="h-3.5 w-3.5" />
                        {genotypeInfo[g].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dam */}
            <div>
              <label className="text-sm font-medium mb-2 block">גנוטיפ האם</label>
              <Select value={dam} onValueChange={(v) => setDam(v as Genotype)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחרו גנוטיפ" />
                </SelectTrigger>
                <SelectContent>
                  {(["AA", "CA", "CC"] as Genotype[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      <span className="flex items-center gap-2">
                        <Dna className="h-3.5 w-3.5" />
                        {genotypeInfo[g].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCalculate} disabled={!sire || !dam} className="w-full font-semibold">
            <Calculator className="h-4 w-4 ml-2" />
            חשבו הסתברות
          </Button>

          {/* Results */}
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <ArrowDown className="h-5 w-5 text-primary" />
                <h2 className="font-rubik font-bold text-lg">תוצאות צפויות לצאצאים</h2>
              </div>

              <div className="space-y-4">
                {(["AA", "CA", "CC"] as Genotype[]).map((g) => (
                  <div key={g} className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold min-w-[60px] text-center ${genotypeInfo[g].color}`}>
                      {g}
                    </span>
                    <div className="flex-1">
                      <div className="h-8 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result[g]}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full bg-primary/80 rounded-full flex items-center justify-end px-3"
                        >
                          {result[g] > 10 && (
                            <span className="text-xs font-bold text-primary-foreground">{result[g]}%</span>
                          )}
                        </motion.div>
                      </div>
                    </div>
                    {result[g] <= 10 && (
                      <span className="text-sm text-muted-foreground min-w-[40px]">{result[g]}%</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Training recommendation */}
              <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">💡 המלצה למגדל</p>
                {result.AA >= 50 && <p>סיכוי גבוה לצאצאים עם צעד טבעי חזק. זיווג מצוין לקו סוסי צעד!</p>}
                {result.CA >= 50 && result.AA < 50 && <p>רוב הצאצאים יהיו ורסטיליים (CA). מתאים למגדלים שרוצים גמישות.</p>}
                {result.CC >= 50 && <p>סיכוי גבוה לצאצאים ללא צעד טבעי. שקלו שימוש באב/אם עם AA לשיפור.</p>}
                {result.AA === 25 && result.CA === 50 && result.CC === 25 && (
                  <p>תוצאה מעורבת. מומלץ לבדוק כל סייח בנפרד ולהתאים את האימון לגנוטיפ.</p>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
