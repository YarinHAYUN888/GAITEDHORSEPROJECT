import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';

function getGaitData(lang: 'he' | 'en') {
  const isEn = lang === 'en';
  return [
    { name: isEn ? 'Walk' : 'הליכה', min: 6, max: 8, color: '#10b981', dmrt3: false },
    { name: isEn ? 'Trot' : 'טרוט', min: 12, max: 20, color: '#3b82f6', dmrt3: false },
    { name: isEn ? 'Canter' : 'קאנטר', min: 15, max: 25, color: '#f43f5e', dmrt3: false },
    { name: isEn ? 'Pace' : 'פייס', min: 15, max: 30, color: '#f59e0b', dmrt3: true },
    { name: isEn ? 'Tölt' : 'טולט', min: 10, max: 32, color: '#a855f7', dmrt3: true },
    { name: 'Flying Pace', min: 35, max: 50, color: '#ec4899', dmrt3: true },
    { name: isEn ? 'Gallop' : 'גאלופ', min: 40, max: 70, color: '#ef4444', dmrt3: false },
  ];
}

function CustomTooltip({ active, payload, lang }: { active?: boolean; payload?: any[]; lang: string }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-bold text-foreground">{data.name}</p>
        <p className="text-sm text-muted-foreground">{data.min}-{data.max} km/h</p>
        {data.dmrt3 && <p className="text-xs text-amber-400 mt-1">{lang === 'en' ? '🧬 Requires DMRT3' : '🧬 דורש DMRT3'}</p>}
      </div>
    );
  }
  return null;
}

export default function GaitSpeedChart() {
  const { t, lang } = useLanguage();
  const gaitData = getGaitData(lang);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-rubik font-bold">{t("spd.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("spd.subtitle")}</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={gaitData} layout="vertical">
            <XAxis type="number" domain={[0, 75]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} width={80} />
            <Tooltip content={<CustomTooltip lang={lang} />} />
            <Bar dataKey="max" radius={[0, 4, 4, 0]}>
              {gaitData.map((entry, index) => (<Cell key={index} fill={entry.color} fillOpacity={0.8} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs text-muted-foreground">{t("spd.requiresDmrt3")}</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs text-muted-foreground">{t("spd.standardGait")}</span></div>
      </div>

      <div className="mt-4 p-3 bg-muted/30 rounded-xl">
        <p className="text-sm text-muted-foreground">
          <strong className="text-emerald-400">{t("spd.funFact")}</strong> {t("spd.funFactText")}
        </p>
      </div>
    </motion.div>
  );
}
