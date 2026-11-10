import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Shield, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function getComparisons(lang: 'he' | 'en') {
  const isEn = lang === 'en';
  return {
    lateral: {
      title: isEn ? 'Lateral Gait' : 'צעד צדדי (Lateral)',
      subtitle: isEn ? 'Legs on the same side move together' : 'רגליים באותו צד נעות ביחד',
      icon: '⟷',
      examples: ['Pace', 'Tölt', 'Running Walk', 'Paso Llano'],
      pros: isEn
        ? ['Very smooth for the rider — "rocking chair"', 'Less load on the horse\'s back', 'Comfortable for long rides', 'High speed with comfort']
        : ['חלק מאוד לרוכב - "כיסא נדנדה"', 'פחות עומס על גב הסוס', 'נוח לרכיבות ארוכות', 'מהירות גבוהה עם נוחות'],
      cons: isEn
        ? ['Requires special genetics (DMRT3)', 'Less stability on uneven terrain', 'Requires training and control']
        : ['דורש גנטיקה מיוחדת (DMRT3)', 'פחות יציבות בשטח לא אחיד', 'דורש אימון ושליטה'],
      physics: isEn ? 'Center of gravity sways laterally, not up-down' : 'מרכז הכובד מתנדנד צדדית, לא למעלה-למטה',
    },
    diagonal: {
      title: isEn ? 'Diagonal Gait' : 'צעד אלכסוני (Diagonal)',
      subtitle: isEn ? 'Opposite legs move together' : 'רגליים מנוגדות נעות ביחד',
      icon: '⤢',
      examples: ['Trot', 'Piaffe', 'Passage'],
      pros: isEn
        ? ['Maximum stability', 'Natural for all horses', 'Good for precise work', 'Easier to train']
        : ['יציבות מקסימלית', 'טבעי לכל הסוסים', 'טוב לעבודה מדויקת', 'קל יותר לאימון'],
      cons: isEn
        ? ['Vertical jolting ("bouncing")', 'More load on the rider\'s back', 'Less comfortable for long rides']
        : ['טלטול אנכי ("קפיצות")', 'יותר עומס על גב הרוכב', 'פחות נוח לרכיבות ארוכות'],
      physics: isEn ? 'Center of gravity rises and falls — creates jolting' : 'מרכז הכובד עולה ויורד - יוצר טלטול',
    },
  };
}

type TabKey = 'lateral' | 'diagonal';

export default function LateralVsDiagonalExplainer() {
  const [activeTab, setActiveTab] = useState<TabKey>('lateral');
  const { t, lang } = useLanguage();
  const comparisons = getComparisons(lang);
  const active = comparisons[activeTab];

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <ArrowLeftRight className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-rubik font-bold">{t("lat.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("lat.subtitle")}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(Object.entries(comparisons) as [TabKey, typeof comparisons['lateral']][]).map(([key, data]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all border ${
              activeTab === key
                ? key === 'lateral' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground border-transparent'
            }`}>
            <span className="text-2xl ml-2">{data.icon}</span>{data.title}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-muted/30 rounded-xl p-6 flex flex-col items-center justify-center">
          <h4 className="text-center text-foreground font-semibold mb-4">{active.subtitle}</h4>
          <div className="relative h-32 w-full flex items-center justify-center">
            {activeTab === 'lateral' ? (
              <motion.div className="flex gap-8" animate={{ x: [0, 15, 0, -15, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                <div className="flex flex-col gap-2 items-center"><div className="w-6 h-6 rounded-full bg-amber-500" /><div className="w-6 h-6 rounded-full bg-amber-500" /></div>
                <div className="flex flex-col gap-2 items-center"><div className="w-6 h-6 rounded-full bg-amber-500/30" /><div className="w-6 h-6 rounded-full bg-amber-500/30" /></div>
              </motion.div>
            ) : (
              <motion.div className="flex gap-8" animate={{ y: [0, -10, 0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <div className="flex flex-col gap-2 items-center"><div className="w-6 h-6 rounded-full bg-blue-500" /><div className="w-6 h-6 rounded-full bg-blue-500/30" /></div>
                <div className="flex flex-col gap-2 items-center"><div className="w-6 h-6 rounded-full bg-blue-500/30" /><div className="w-6 h-6 rounded-full bg-blue-500" /></div>
              </motion.div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center italic">{active.physics}</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">{t("lat.examples")}</p>
            <p className="text-sm text-muted-foreground">{active.examples.join(', ')}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-emerald-400" /><span className="text-sm font-semibold text-foreground">{t("lat.advantages")}</span></div>
            <ul className="space-y-1">{active.pros.map((p) => (<li key={p} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="text-emerald-400 mt-0.5">✓</span>{p}</li>))}</ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-amber-400" /><span className="text-sm font-semibold text-foreground">{t("lat.disadvantages")}</span></div>
            <ul className="space-y-1">{active.cons.map((c) => (<li key={c} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="text-amber-400 mt-0.5">!</span>{c}</li>))}</ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
