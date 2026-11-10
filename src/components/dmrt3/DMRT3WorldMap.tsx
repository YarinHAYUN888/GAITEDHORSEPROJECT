import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

function getBreedFrequencies(lang: 'he' | 'en') {
  const isEn = lang === 'en';
  return [
    { breed: 'Icelandic Horse', frequency: 0.94, region: isEn ? 'Europe' : 'אירופה', color: 'bg-emerald-500', country: '🇮🇸' },
    { breed: 'Paso Fino', frequency: 0.92, region: isEn ? 'South America' : 'דרום אמריקה', color: 'bg-emerald-500', country: '🇨🇴' },
    { breed: 'Tennessee Walker', frequency: 0.89, region: isEn ? 'North America' : 'צפון אמריקה', color: 'bg-emerald-500', country: '🇺🇸' },
    { breed: 'Peruvian Paso', frequency: 0.85, region: isEn ? 'South America' : 'דרום אמריקה', color: 'bg-emerald-500', country: '🇵🇪' },
    { breed: 'Rocky Mountain', frequency: 0.82, region: isEn ? 'North America' : 'צפון אמריקה', color: 'bg-emerald-500', country: '🇺🇸' },
    { breed: 'Standardbred (Pacer)', frequency: 0.78, region: isEn ? 'North America' : 'צפון אמריקה', color: 'bg-emerald-500', country: '🇺🇸' },
    { breed: 'Am. Saddlebred', frequency: 0.72, region: isEn ? 'North America' : 'צפון אמריקה', color: 'bg-amber-500', country: '🇺🇸' },
    { breed: 'Mangalarga', frequency: 0.48, region: isEn ? 'South America' : 'דרום אמריקה', color: 'bg-amber-500', country: '🇧🇷' },
    { breed: 'Morgan Horse', frequency: 0.28, region: isEn ? 'North America' : 'צפון אמריקה', color: 'bg-amber-500', country: '🇺🇸' },
    { breed: 'Standardbred (Trotter)', frequency: 0.15, region: isEn ? 'North America' : 'צפון אמריקה', color: 'bg-slate-500', country: '🇺🇸' },
    { breed: 'Quarter Horse', frequency: 0.05, region: isEn ? 'North America' : 'צפון אמריקה', color: 'bg-slate-500', country: '🇺🇸' },
    { breed: 'Arabian', frequency: 0.02, region: isEn ? 'Middle East' : 'מזרח תיכון', color: 'bg-slate-500', country: '🇸🇦' },
    { breed: 'Thoroughbred', frequency: 0.0, region: isEn ? 'Europe' : 'אירופה', color: 'bg-red-500', country: '🇬🇧' },
    { breed: 'Przewalski', frequency: 0.0, region: isEn ? 'Asia' : 'אסיה', color: 'bg-red-500', country: '🇲🇳' },
  ];
}

export default function DMRT3WorldMap() {
  const { t, lang } = useLanguage();
  const breedFrequencies = getBreedFrequencies(lang);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-rubik font-bold">{t("wmap.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("wmap.subtitle")}</p>
        </div>
      </div>

      <div className="space-y-3">
        {breedFrequencies.map((b, i) => (
          <motion.div key={b.breed} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3">
            <span className="text-lg w-8 text-center">{b.country}</span>
            <span className="text-sm text-muted-foreground w-40 sm:w-48 truncate text-right">{b.breed}</span>
            <div className="flex-1 h-7 bg-muted/20 rounded-full overflow-hidden relative">
              <motion.div initial={{ width: 0 }} animate={{ width: `${b.frequency * 100}%` }}
                transition={{ delay: i * 0.03 + 0.2, duration: 0.6, ease: 'easeOut' }}
                className={`h-full ${b.color}/60 rounded-full`} />
              {b.frequency > 0.1 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/80">{Math.round(b.frequency * 100)}%</span>}
              {b.frequency > 0 && b.frequency <= 0.1 && <span className="absolute left-[calc(100%*var(--f)+8px)] top-1/2 -translate-y-1/2 text-xs text-muted-foreground" style={{ '--f': b.frequency } as React.CSSProperties}>{Math.round(b.frequency * 100)}%</span>}
              {b.frequency === 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-400/80">0%</span>}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 mt-6 justify-center">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">{t("wmap.legendHigh")}</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs text-muted-foreground">{t("wmap.legendMixed")}</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500" /><span className="text-xs text-muted-foreground">{t("wmap.legendRare")}</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-muted-foreground">{t("wmap.legendNone")}</span></div>
      </div>

      <div className="mt-4 p-3 bg-muted/30 rounded-xl">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{t("wmap.insight")}</strong> {t("wmap.insightText")}
        </p>
      </div>
    </motion.div>
  );
}
