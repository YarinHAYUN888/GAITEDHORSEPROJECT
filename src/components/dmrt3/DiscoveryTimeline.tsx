import { motion } from 'framer-motion';
import { Calendar, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function getDiscoveries(lang: 'he' | 'en') {
  const isEn = lang === 'en';
  return [
    { year: '2012', title: isEn ? 'DMRT3 Gene Discovery' : 'גילוי גן DMRT3', description: isEn ? 'Andersson et al. first identify the link between DMRT3 mutation and special gaits. Published in Nature.' : 'Andersson et al. מזהים לראשונה את הקשר בין מוטציית DMRT3 לצעדים מיוחדים. פרסום ב-Nature.', source: 'Nature 488: 642-646', color: 'from-primary to-purple-600', icon: '🧬' },
    { year: '2014', title: isEn ? 'Global Spread + Standardbreds' : 'התפשטות עולמית + Standardbreds', description: isEn ? 'Promerová et al. tested 4,396 horses from 141 breeds. Jäderkvist et al. proved effects on trotter and pacer performance.' : 'Promerová et al. בודקים 4,396 סוסים מ-141 גזעים. Jäderkvist et al. מוכיחים השפעה על ביצועי טרוטרים ופייסרים.', source: 'Anim. Genet. 45(2) / J. Anim. Sci. 92(10)', color: 'from-blue-500 to-cyan-500', icon: '🌍' },
    { year: '2015', title: isEn ? 'Effect on Riding and Competitions' : 'השפעה על רכיבה ותחרויות', description: isEn ? 'Jäderkvist et al. showed the mutation affects riding traits in Standardbreds and Icelandics. Linked to 4 vs 5 gaits.' : 'Jäderkvist et al. מוכיחים שהמוטציה משפיעה על תכונות רכיבה בסטנדרדברדים ואיסלנדיים. קשר ל-4 מול 5 צעדים.', source: 'Livestock Science 176: 33-39', color: 'from-amber-500 to-orange-500', icon: '🏇' },
    { year: '2021', title: isEn ? 'DMRT3 in Non-Gaited Breeds' : 'DMRT3 בגזעים לא-גייטד', description: isEn ? 'Etalon study of 11,463 horses from 88 breeds. Found AA in Roping horses and CA in Reining/Hunter. The gait gene isn\'t just for gaited breeds!' : 'מחקר Etalon על 11,463 סוסים מ-88 גזעים. נמצא AA בסוסי Roping ו-CA בסוסי Reining/Hunter. גן הגייט לא רק לגייטד!', source: 'Rosa et al., Animal Genetics 52(5)', color: 'from-emerald-500 to-teal-500', icon: '🔬' },
    { year: '2023', title: isEn ? 'Beyond DMRT3: RELN & STAU2' : 'מעבר ל-DMRT3: RELN & STAU2', description: isEn ? 'Sigurðardóttir et al. discovered two additional genes affecting pace. Epistasis between all three genes explains 27.4% of variance.' : 'Sigurðardóttir et al. מגלים שני גנים נוספים שמשפיעים על פייס. אינטראקציה (epistasis) בין שלושת הגנים מסבירה 27.4% מהשונות.', source: 'Genet. Sel. Evol. 55: 89', color: 'from-purple-500 to-pink-500', icon: '🧩' },
    { year: '2025', title: isEn ? 'STAU2 Frameshift Mutation' : 'מוטציית STAU2 frameshift', description: isEn ? 'Follow-up study identifies a specific frameshift mutation in STAU2 and regulatory elements in RELN affecting Icelandic horse performance.' : 'מחקר המשך מזהה מוטציית frameshift ספציפית ב-STAU2 ואלמנטים רגולטוריים ב-RELN שמשפיעים על ביצועי סוסים איסלנדיים.', source: 'Sci. Rep. (2025)', color: 'from-rose-500 to-red-500', icon: '🚀' },
  ];
}

export default function DiscoveryTimeline() {
  const { t, lang } = useLanguage();
  const discoveries = getDiscoveries(lang);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-rubik font-bold">{t("tl.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("tl.subtitle")}</p>
        </div>
      </div>
      <div className="relative">
        <div className="absolute right-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/60 via-purple-500/40 to-rose-500/60" />
        <div className="space-y-8">
          {discoveries.map((d, i) => (
            <motion.div key={d.year} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex gap-4 relative">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center shadow-lg flex-shrink-0 z-10 text-xl`}>{d.icon}</div>
              <div className="flex-1 bg-muted/20 border border-border/50 rounded-xl p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-bold font-mono bg-gradient-to-r ${d.color} bg-clip-text text-transparent`}>{d.year}</span>
                  <h4 className="font-bold text-foreground text-sm">{d.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">{d.description}</p>
                <p className="text-xs text-muted-foreground/60 flex items-center gap-1"><ExternalLink className="w-3 h-3" />{d.source}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
