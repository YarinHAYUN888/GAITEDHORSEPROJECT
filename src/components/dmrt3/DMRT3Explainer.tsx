import { motion } from 'framer-motion';
import { Dna, Microscope, Activity, AlertCircle, Sparkles } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import DMRT3GenotypeDetails from './DMRT3GenotypeDetails';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DMRT3Explainer() {
  const { t } = useLanguage();

  return (
    <div className="space-y-10">
      {/* Main Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent p-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Dna className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <Badge variant="secondary" className="mb-2">{t("d3exp.badge")}</Badge>
              <h1 className="text-3xl md:text-4xl font-rubik font-bold text-foreground">{t("d3exp.title")}</h1>
              <p className="text-muted-foreground text-lg">{t("d3exp.subtitle")}</p>
            </div>
          </div>
        </div>
        <div className="p-8">
          <p className="text-muted-foreground leading-relaxed text-lg">
            {t("d3exp.intro")} <strong className="text-foreground">{t("d3exp.gaitkeeper")}</strong>, {t("d3exp.introEnd")}
          </p>
        </div>
      </motion.div>

      {/* The Mutation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <Microscope className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-rubik font-bold">{t("d3exp.mutationTitle")}</h2>
        </div>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            {t("d3exp.mutationP1")} <strong className="text-foreground">nonsense mutation (Ser301STOP)</strong>
            {' '}{t("d3exp.mutationP1detail")}
            {' '}<strong className="text-foreground">{t("d3exp.stopCodon")}</strong> {t("d3exp.inProtein")}
          </p>
          <p>
            {t("d3exp.fullProtein")} <strong className="text-foreground">539 {t("d3exp.aminoAcids")}</strong>,
            {' '}{t("d3exp.truncatedProtein")} <strong className="text-foreground">301 {t("d3exp.aminoAcids")}</strong>.
            {' '}{t("d3exp.truncatedDetail")}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[
            { label: t('d3exp.factChromosome'), value: 'ECA23' },
            { label: t('d3exp.factPosition'), value: '22,999,655' },
            { label: t('d3exp.factChange'), value: 'C → A' },
            { label: t('d3exp.factType'), value: 'Nonsense' },
          ].map((fact) => (
            <div key={fact.label} className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{fact.label}</p>
              <p className="text-sm font-bold text-foreground font-mono">{fact.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Nuances */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="glass-card p-8 border-r-4 border-amber-500/50">
        <div className="flex items-center gap-3 mb-6">
          <AlertCircle className="h-6 w-6 text-amber-400" />
          <h2 className="text-2xl font-rubik font-bold">{t("d3exp.nuancesTitle")}</h2>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">{t("d3exp.nuancesBadge")}</Badge>
        </div>
        <div className="space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <h4 className="font-bold text-foreground mb-2">{t("d3exp.nuance1Title")}</h4>
            <p className="text-sm text-muted-foreground">{t("d3exp.nuance1Text")}</p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <h4 className="font-bold text-foreground mb-2">{t("d3exp.nuance2Title")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("d3exp.nuance2Text")} <strong className="text-foreground">{t("d3exp.nuance2Bold")}</strong> {t("d3exp.nuance2End")}
            </p>
          </div>
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
            <h4 className="font-bold text-foreground mb-2">{t("d3exp.nuance3Title")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("d3exp.nuance3Text")} <strong className="text-foreground">{t("d3exp.nuance3Bold")}</strong> {t("d3exp.nuance3End")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Spine */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-rubik font-bold">{t("d3exp.spineTitle")}</h2>
        </div>
        <div className="bg-muted/30 rounded-xl p-6 mb-8">
          <h3 className="text-center text-foreground font-semibold mb-6 text-lg">{t("d3exp.spineCenter")}</h3>
          <div className="relative max-w-md mx-auto">
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/60 via-primary/40 to-primary/20 -translate-x-1/2 rounded-full" />
            <div className="text-center mb-8 relative">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-2">
                <span className="text-foreground font-semibold">{t("d3exp.brain")}</span>
              </div>
              <div className="h-6 w-0.5 bg-primary/40 mx-auto" />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-8 relative">
              <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="text-blue-400 font-bold text-sm mb-1">{t("d3exp.interneurons")}</div>
                <p className="text-xs text-muted-foreground">{t("d3exp.interneuronsDesc")}</p>
              </div>
              <div className="text-center p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <div className="text-primary font-bold text-sm mb-1"><Dna className="h-4 w-4 mx-auto mb-1" /></div>
                <p className="text-xs text-muted-foreground">{t("d3exp.dmrt3Active")}</p>
              </div>
              <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-emerald-400 font-bold text-sm mb-1">{t("d3exp.motorNeurons")}</div>
                <p className="text-xs text-muted-foreground">{t("d3exp.motorNeuronsDesc")}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[t('d3exp.legRF'), t('d3exp.legLF'), t('d3exp.legRH'), t('d3exp.legLH')].map((label) => (
                <div key={label} className="p-2 bg-muted/50 rounded-lg">
                  <div className="text-lg mb-1">🦵</div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { num: 1, title: t('d3exp.card1Title'), text: t('d3exp.card1Text') },
            { num: 2, title: t('d3exp.card2Title'), text: t('d3exp.card2Text') },
            { num: 3, title: t('d3exp.card3Title'), text: t('d3exp.card3Text') },
          ].map((card) => (
            <motion.div key={card.num} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + card.num * 0.1 }} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">{card.num}</span>
              </div>
              <h4 className="font-bold text-foreground mb-2">{card.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Beyond DMRT3 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="glass-card p-8 border-r-4 border-purple-500/50">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-rubik font-bold">{t("d3exp.beyondTitle")}</h2>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">{t("d3exp.beyondBadge")}</Badge>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {t("d3exp.beyondIntro")} <strong className="text-foreground">{t("d3exp.beyondBold")}</strong> {t("d3exp.beyondEnd")}
        </p>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 text-sm font-bold flex items-center justify-center font-mono">R</span>
              <div><h4 className="font-bold text-foreground">RELN (Reelin)</h4><p className="text-xs text-muted-foreground">ECA4</p></div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("d3exp.relnDesc")} <strong className="text-foreground">{t("d3exp.relnBold")}</strong>.
            </p>
          </div>
          <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 text-sm font-bold flex items-center justify-center font-mono">S</span>
              <div><h4 className="font-bold text-foreground">STAU2 (Staufen2)</h4><p className="text-xs text-muted-foreground">ECA9</p></div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("d3exp.stau2Desc")} <strong className="text-foreground">{t("d3exp.stau2Bold")}</strong> {t("d3exp.stau2End")}
            </p>
          </div>
        </div>
        <div className="bg-muted/30 rounded-xl p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{t("d3exp.bigPicture")}</strong> {t("d3exp.bigPictureEnd")}
          </p>
        </div>
        <div className="mt-4 bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
          <h4 className="font-bold text-foreground mb-2">{t("d3exp.conformTitle")}</h4>
          <p className="text-sm text-muted-foreground">{t("d3exp.conformText")}</p>
        </div>
      </motion.div>

      <DMRT3GenotypeDetails />

      {/* Discovery */}
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="glass-card p-8">
        <h2 className="text-xl font-rubik font-bold mb-4">{t("d3exp.discoveryTitle")}</h2>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>{t("d3exp.discoveryP1")}</p>
          <p>{t("d3exp.discoveryP2")}</p>
          <p className="text-xs text-muted-foreground/70 italic">
            Andersson et al. (2012) Nature 488: 642-646 • Promerová et al. (2014) Anim. Genet. 45(2): 274-282
          </p>
        </div>
      </motion.div>
    </div>
  );
}
