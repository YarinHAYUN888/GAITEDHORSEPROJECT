import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calculator } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type Genotype = 'AA' | 'CA' | 'CC';

const genotypeColors: Record<Genotype, string> = { AA: 'bg-emerald-500', CA: 'bg-amber-500', CC: 'bg-slate-500' };

function getGenotypeLabels(lang: 'he' | 'en'): Record<Genotype, string> {
  return lang === 'en'
    ? { AA: 'Homozygous (AA) — fully gaited', CA: 'Heterozygous (CA) — carrier', CC: 'Wild type (CC) — no mutation' }
    : { AA: 'הומוזיגוט (AA) — גייטד מלא', CA: 'הטרוזיגוט (CA) — נשא', CC: 'טיפוס בר (CC) — ללא מוטציה' };
}

function getOffspringProbabilities(sire: Genotype, dam: Genotype): Record<Genotype, number> {
  const sireAlleles = sire === 'AA' ? ['A', 'A'] : sire === 'CA' ? ['C', 'A'] : ['C', 'C'];
  const damAlleles = dam === 'AA' ? ['A', 'A'] : dam === 'CA' ? ['C', 'A'] : ['C', 'C'];
  const results: Record<string, number> = { AA: 0, CA: 0, CC: 0 };
  for (const s of sireAlleles) {
    for (const d of damAlleles) {
      const pair = [s, d].sort().join('');
      const key = pair === 'AA' ? 'AA' : pair === 'AC' ? 'CA' : 'CC';
      results[key] += 25;
    }
  }
  return results as Record<Genotype, number>;
}

export default function InheritanceCalculator() {
  const [sire, setSire] = useState<Genotype>('AA');
  const [dam, setDam] = useState<Genotype>('CA');
  const { t, lang } = useLanguage();
  const genotypeLabels = getGenotypeLabels(lang);
  const probabilities = useMemo(() => getOffspringProbabilities(sire, dam), [sire, dam]);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-rubik font-bold">{t("inh.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("inh.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">{t("inh.sire")}</p>
          <div className="space-y-2">
            {(['AA', 'CA', 'CC'] as Genotype[]).map((g) => (
              <button key={g} onClick={() => setSire(g)}
                className={`w-full text-right p-3 rounded-xl border transition-all text-sm ${
                  sire === g
                    ? `${genotypeColors[g]}/20 border-${g === 'AA' ? 'emerald' : g === 'CA' ? 'amber' : 'slate'}-500/50 text-foreground font-bold`
                    : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/30'
                }`}>
                <span className="font-mono font-bold ml-2">{g}</span>
                {genotypeLabels[g].split('—')[1]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">{t("inh.dam")}</p>
          <div className="space-y-2">
            {(['AA', 'CA', 'CC'] as Genotype[]).map((g) => (
              <button key={g} onClick={() => setDam(g)}
                className={`w-full text-right p-3 rounded-xl border transition-all text-sm ${
                  dam === g
                    ? `${genotypeColors[g]}/20 border-${g === 'AA' ? 'emerald' : g === 'CA' ? 'amber' : 'slate'}-500/50 text-foreground font-bold`
                    : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/30'
                }`}>
                <span className="font-mono font-bold ml-2">{g}</span>
                {genotypeLabels[g].split('—')[1]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-muted/20 rounded-xl p-6 border border-border/30">
        <h4 className="font-bold text-foreground mb-4 text-center">{t("inh.resultsTitle")}</h4>
        <div className="grid grid-cols-3 gap-4">
          {(['AA', 'CA', 'CC'] as Genotype[]).map((g) => {
            const prob = probabilities[g];
            return (
              <motion.div key={g} animate={{ scale: prob > 0 ? 1 : 0.9, opacity: prob > 0 ? 1 : 0.3 }} className="text-center">
                <div className="relative h-32 mb-3 flex items-end justify-center">
                  <motion.div animate={{ height: `${prob}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={`w-16 ${genotypeColors[g]}/60 rounded-t-lg relative`}>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold text-foreground">{prob}%</span>
                  </motion.div>
                </div>
                <span className="font-mono font-bold text-foreground">{g}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  {g === 'AA' ? t("inh.fullGait") : g === 'CA' ? t("inh.carrier") : t("inh.noMutation")}
                </p>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-6 p-3 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            {probabilities.AA >= 50 && t("inh.highChance")}
            {probabilities.AA === 0 && probabilities.CA > 0 && t("inh.noFullChance")}
            {probabilities.AA === 0 && probabilities.CA === 0 && t("inh.allCC")}
            {probabilities.AA === 25 && t("inh.oneInFour")}
            {probabilities.AA === 100 && t("inh.allAA")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
