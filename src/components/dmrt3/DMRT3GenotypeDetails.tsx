import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Zap, Brain, Activity, Award, Info } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useLanguage } from '@/contexts/LanguageContext';

function getGenotypeData(lang: 'he' | 'en') {
  const isEn = lang === 'en';
  return {
    AA: {
      title: 'AA - Homozygous Mutant',
      titleHe: isEn ? 'Homozygous mutant' : 'הומוזיגוט למוטציה',
      color: 'emerald' as const, icon: CheckCircle,
      summary: isEn ? 'Two copies of the mutation — natural and pronounced lateral gaits' : 'שני עותקים של המוטציה - צעדים לטרליים טבעיים ומובהקים',
      details: {
        gaits: isEn ? ['Quality Tölt', 'Flying Pace', 'Paso Fino', 'Running Walk', 'Rack'] : ['Tölt איכותי', 'Flying Pace', 'Paso Fino', 'Running Walk', 'Rack'],
        strengths: isEn
          ? ['Natural ability for smooth 4-beat gaits', 'High stability at moderate speeds', 'Advantage in harness racing (maintaining trot/pace)', 'Maximum rider comfort']
          : ['יכולת טבעית לצעדים 4-פעימות חלקים', 'יציבות גבוהה במהירויות בינוניות', 'יתרון במירוצי רתמות (שמירה על טרוט/פייס)', 'נוחות רכיבה מקסימלית'],
        weaknesses: isEn
          ? ['Difficulty transitioning to canter/gallop', 'Lower gallop scores in competitions', 'Less flexibility between fast gaits']
          : ['קושי במעבר לקאנטר/גאלופ', 'ציוני גאלופ נמוכים יותר בתחרויות', 'פחות גמישות בין צעדים מהירים'],
        breeds: ['Tennessee Walking Horse', 'Standardbred (Pacers)', 'Icelandic (5-gaiters)', 'Paso Fino', 'Rocky Mountain Horse'],
        prevalence: isEn ? '60-95% in gaited breeds' : '60-95% בגזעי גייט',
        research: 'Andersson et al. (2012), Jäderkvist et al. (2015)',
        caveat: isEn
          ? '⚠️ Despite being AA, over 30% of Icelandic horses with this genotype don\'t develop pace. Additional genes (RELN, STAU2) and body conformation play a role.'
          : '⚠️ למרות שיש AA, יותר מ-30% מהסוסים האיסלנדיים עם גנוטיפ זה לא מפתחים פייס. גנים נוספים (RELN, STAU2) ומבנה גוף משפיעים.',
      }
    },
    CA: {
      title: 'CA - Heterozygous',
      titleHe: isEn ? 'Heterozygous (one carrier)' : 'הטרוזיגוט (נשא אחד)',
      color: 'amber' as const, icon: Zap,
      summary: isEn ? 'One copy of the mutation — maximum flexibility between movement styles' : 'עותק אחד של המוטציה - גמישות מקסימלית בין סגנונות תנועה',
      details: {
        gaits: isEn ? ['Tölt', 'Quality Trot', 'Balanced Canter', 'Gait flexibility'] : ['Tölt', 'Trot איכותי', 'Canter מאוזן', 'גמישות בין צעדים'],
        strengths: isEn
          ? ['Excellent balance between gait and classic gaits', 'Easy transition to quality canter', 'Versatility in competitions', 'Suitable for dressage and gait together']
          : ['איזון מצוין בין צעדי גייט לצעדים קלאסיים', 'מעבר קל לקאנטר איכותי', 'רב-תכליתיות בתחרויות', 'מתאים לדרסאז\' וגייט יחד'],
        weaknesses: isEn
          ? ['Gait patterns less "pure" than AA', 'May show mixed batida and picada', 'Requires more focused training', 'Possible difficulty with lead and tempi changes']
          : ['צעדי גייט פחות "טהורים" מ-AA', 'עלול להציג batida ו-picada מעורבים', 'דורש אימון ממוקד יותר', 'קושי אפשרי בהחלפות lead ו-tempi changes'],
        breeds: ['Mangalarga Marchador', 'Icelandic (4-gaiters)', 'American Saddlebred', 'Quarter Horse', 'Arabian'],
        prevalence: isEn ? '20-40% in gaited breeds' : '20-40% בגזעי גייט',
        research: 'Patterson et al. (2015), Fonseca et al. (2017), Rosa et al. (2021)',
        caveat: isEn
          ? '💡 Correlation found between CA and Reining/Hunter disciplines in Stock-type horses — the A allele may give advantages in classic gaits too.'
          : '💡 נמצאה קורלציה בין CA לדיסציפלינות Reining ו-Hunter בסוסי Stock-type — ייתכן שהאלל A נותן יתרון גם בצעדים קלאסיים.',
      }
    },
    CC: {
      title: 'CC - Wild Type',
      titleHe: isEn ? 'Wild type (no mutation)' : 'טיפוס בר (ללא מוטציה)',
      color: 'slate' as const, icon: AlertTriangle,
      summary: isEn ? 'No mutation — classic diagonal gaits, but not necessarily without gaiting ability' : 'ללא המוטציה - צעדים דיאגונליים קלאסיים, אבל לא בהכרח ללא צעדי גייט',
      details: {
        gaits: isEn ? ['Walk', 'Trot', 'Canter', 'Gallop', 'Tölt (limited — in Icelandic)'] : ['Walk', 'Trot', 'Canter', 'Gallop', 'Tölt (מוגבל — באיסלנדי)'],
        strengths: isEn
          ? ['Quality gallop and canter', 'Excellent diagonal synchronization', 'Suitable for classical dressage', 'Jumping and speed events', 'Smooth gait transitions']
          : ['גאלופ וקאנטר איכותיים', 'סינכרון אלכסוני מעולה', 'מתאים לדרסאז\' קלאסי', 'קפיצות ואירועי מהירות', 'מעברי צעד חלקים'],
        weaknesses: isEn
          ? ['No natural tendency for gaited gaits', 'Lateral movement causes instability', 'Not suitable for harness racing']
          : ['אין נטייה טבעית לצעדי גייט', 'תנועה לטרלית גורמת לחוסר יציבות', 'לא מתאים למירוצי רתמות'],
        breeds: ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Warmblood'],
        prevalence: isEn ? '95%+ in non-gaited breeds' : '95%+ בגזעים לא-גייטד',
        research: 'Regatieri et al. (2016), Kristjansson et al. (2014)',
        caveat: isEn
          ? '🐴 Important: CC Icelandic horses can perform tölt — but it\'s harder and their trot/gallop scores are usually higher than AA.'
          : '🐴 חשוב: סוסי CC איסלנדיים כן יכולים לבצע טולט — אבל זה קשה יותר וציוני הטרוט/גאלופ שלהם בדרך כלל גבוהים יותר מ-AA.',
      }
    }
  };
}

const colorClasses = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

function GenotypeCard({ genotype, data, isExpanded, onToggle }: {
  genotype: string; data: ReturnType<typeof getGenotypeData>['AA']; isExpanded: boolean; onToggle: () => void;
}) {
  const { t } = useLanguage();
  const Icon = data.icon;
  const colors = colorClasses[data.color];

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden transition-all`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 text-right">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div className="text-right">
            <h3 className="font-bold text-foreground">{data.title}</h3>
            <p className="text-sm text-muted-foreground">{data.titleHe}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-5 pt-0 space-y-4">
              <p className="text-muted-foreground">{data.summary}</p>
              {data.details.caveat && (
                <div className="bg-muted/30 border border-border/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground flex items-start gap-2"><Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />{data.details.caveat}</p>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2"><Activity className={`w-4 h-4 ${colors.text}`} /><span className="text-sm font-semibold text-foreground">{t("geno.possibleGaits")}</span></div>
                <div className="flex flex-wrap gap-2">{data.details.gaits.map((gait) => (<Badge key={gait} variant="outline" className={colors.badge}>{gait}</Badge>))}</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-sm font-semibold text-foreground">{t("geno.strengths")}</span></div>
                <ul className="space-y-1">{data.details.strengths.map((s) => (<li key={s} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="text-emerald-400 mt-0.5">✓</span>{s}</li>))}</ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-sm font-semibold text-foreground">{t("geno.weaknesses")}</span></div>
                <ul className="space-y-1">{data.details.weaknesses.map((w) => (<li key={w} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="text-amber-400 mt-0.5">!</span>{w}</li>))}</ul>
              </div>
              <div>
                <p className="text-sm text-foreground font-semibold">{t("geno.commonBreeds")}</p>
                <p className="text-sm text-muted-foreground">{data.details.breeds.join(', ')}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("geno.prevalenceLabel")} {data.details.prevalence}</span>
                <span className="flex items-center gap-1">📚 {data.details.research}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CPGExplainer() {
  const { t } = useLanguage();
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-lg">{t("geno.cpgTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("geno.cpgSubtitle")}</p>
        </div>
      </div>
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>{t("geno.cpgIntro")}</p>
        <div>
          <h4 className="font-semibold text-foreground mb-2">{t("geno.cpgHow")}</h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2"><span>•</span>{t("geno.cpg1")}</li>
            <li className="flex items-start gap-2"><span>•</span>{t("geno.cpg2")}</li>
            <li className="flex items-start gap-2"><span>•</span>{t("geno.cpg3")}</li>
            <li className="flex items-start gap-2"><span>•</span><strong className="text-foreground">{t("geno.cpg4New")}</strong> {t("geno.cpg4")}</li>
          </ul>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-sm">
            <Dna className="w-4 h-4 inline mr-1 text-amber-400" />
            <strong className="text-amber-400">{t("geno.koTitle")}</strong> {t("geno.koText")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ComparisonTable() {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const rows = isEn
    ? [['4-beat gaits','⭐⭐⭐','⭐⭐','—'],['Gallop quality','⭐','⭐⭐⭐','⭐⭐⭐'],['Canter transition','Hard','Medium','Easy'],['Harness racing','Excellent','Good','Not suitable'],['Rider comfort','⭐⭐⭐','⭐⭐','⭐'],['Versatility','⭐⭐','⭐⭐⭐','⭐⭐⭐'],['Lead changes','Very hard','Some difficulty','Easy']]
    : [['צעדי 4-פעימות','⭐⭐⭐','⭐⭐','—'],['איכות גאלופ','⭐','⭐⭐⭐','⭐⭐⭐'],['מעבר לקאנטר','קשה','בינוני','קל'],['מירוצי רתמות','מצוין','טוב','לא מתאים'],['נוחות רכיבה','⭐⭐⭐','⭐⭐','⭐'],['רב-תכליתיות','⭐⭐','⭐⭐⭐','⭐⭐⭐'],['Lead changes','קשה מאוד','קושי מסוים','קל']];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-primary" />
        <span className="font-bold text-foreground">{t("geno.compTitle")}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right py-3 px-4 font-semibold">{t("geno.compFeature")}</th>
              <th className="text-center py-3 px-4 font-semibold text-emerald-400">AA</th>
              <th className="text-center py-3 px-4 font-semibold text-amber-400">CA</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-400">CC</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {rows.map(([label, aa, ca, cc], i) => (
              <tr key={label} className={i < 6 ? 'border-b border-border/50' : ''}>
                <td className="py-3 px-4 font-semibold text-foreground">{label}</td>
                <td className="text-center py-3 px-4">{aa}</td>
                <td className="text-center py-3 px-4">{ca}</td>
                <td className="text-center py-3 px-4">{cc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-4 italic">
        * Patterson et al. (2015), Jäderkvist et al. (2015), Fegraeus et al. (2015), Etalon DX (2024)
      </p>
    </div>
  );
}

export default function DMRT3GenotypeDetails() {
  const [expandedGenotype, setExpandedGenotype] = useState<string | null>('AA');
  const { t, lang } = useLanguage();
  const GENOTYPE_DATA = getGenotypeData(lang);

  return (
    <div className="space-y-6">
      <CPGExplainer />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Dna className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground text-lg">{t("geno.detailsTitle")}</span>
        </div>
        {Object.entries(GENOTYPE_DATA).map(([genotype, data]) => (
          <GenotypeCard key={genotype} genotype={genotype} data={data as any} isExpanded={expandedGenotype === genotype} onToggle={() => setExpandedGenotype(expandedGenotype === genotype ? null : genotype)} />
        ))}
      </div>
      <ComparisonTable />
    </div>
  );
}
