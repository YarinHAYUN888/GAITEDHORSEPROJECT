import { motion } from 'framer-motion';
import { Dna } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const TOTAL_AA = 539;
const STOP_POS = 301;
const PERCENT = Math.round((STOP_POS / TOTAL_AA) * 100);

export default function ProteinDiagram() {
  const { t } = useLanguage();

  const domains = [
    { name: 'DM Domain', start: 58, end: 120, color: 'bg-blue-500', description: t('prot.dnaBinding') },
    { name: 'Transactivation', start: 200, end: 350, color: 'bg-emerald-500', description: t('prot.geneActivation') },
    { name: 'C-terminal', start: 400, end: 539, color: 'bg-purple-500', description: t('prot.regulation') },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
          <Dna className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-rubik font-bold">{t("prot.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("prot.subtitle")}</p>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-slate-400 font-mono">CC</span>
            <span className="text-sm text-muted-foreground">{t("prot.normal")} — {TOTAL_AA} {t("prot.aminoAcids")}</span>
          </div>
          <div className="relative h-12 bg-muted/30 rounded-lg overflow-hidden border border-border/50">
            {domains.map((d) => (
              <div key={d.name} className={`absolute top-0 bottom-0 ${d.color}/40`}
                style={{ left: `${(d.start / TOTAL_AA) * 100}%`, width: `${((d.end - d.start) / TOTAL_AA) * 100}%` }}>
                <div className={`h-full ${d.color}/60 flex items-center justify-center`}>
                  <span className="text-[10px] font-bold text-white/80 whitespace-nowrap hidden sm:block">{d.name}</span>
                </div>
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-600/30 to-slate-600/10 rounded-lg" />
            <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">1</div>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">{TOTAL_AA}</div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-emerald-400 font-mono">AA</span>
            <span className="text-sm text-muted-foreground">{t("prot.truncated")} — {STOP_POS} {t("prot.aminoAcids")} ({PERCENT}%)</span>
          </div>
          <div className="relative h-12 rounded-lg overflow-hidden border border-border/50">
            <div className="absolute top-0 bottom-0 bg-emerald-500/20 rounded-r-none" style={{ left: 0, width: `${PERCENT}%` }}>
              <div className="absolute top-0 bottom-0 bg-blue-500/60"
                style={{ left: `${(58 / STOP_POS) * 100}%`, width: `${((120 - 58) / STOP_POS) * 100}%` }}>
                <div className="h-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white/80 hidden sm:block">DM ✓</span>
                </div>
              </div>
              <div className="absolute top-0 bottom-0 bg-amber-500/40"
                style={{ left: `${(200 / STOP_POS) * 100}%`, width: `${((STOP_POS - 200) / STOP_POS) * 100}%` }}>
                <div className="h-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white/80 hidden sm:block">{t("prot.partial")}</span>
                </div>
              </div>
            </div>
            <div className="absolute top-0 bottom-0 w-1 bg-red-500 z-10" style={{ left: `${PERCENT}%` }}>
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">STOP</span>
              </motion.div>
            </div>
            <div className="absolute top-0 bottom-0 bg-red-500/5 border-r border-border/50"
              style={{ left: `${PERCENT}%`, width: `${100 - PERCENT}%` }}>
              <div className="h-full flex items-center justify-center">
                <span className="text-xs text-red-400/60 font-mono">{t("prot.missing")}</span>
              </div>
            </div>
            <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">1</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-6">
        {domains.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${d.color}`} />
            <span className="text-xs text-muted-foreground">{d.name} — {d.description}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-xs text-muted-foreground">Stop Codon — Ser301STOP</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/60 mt-4 italic">{t("prot.footnote")}</p>
    </motion.div>
  );
}
