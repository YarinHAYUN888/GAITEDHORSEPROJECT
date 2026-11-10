import React from 'react';
import { GAIT_TYPES, GAIT_CATEGORIES, COLOR_MAP, localizeGait, localizeCategories, type GaitInfo } from './gaitData';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  selected: GaitInfo;
  onSelect: (g: GaitInfo) => void;
}

export default function GaitSelector({ selected, onSelect }: Props) {
  const { lang } = useLanguage();
  const categories = localizeCategories(lang);

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const gaits = GAIT_TYPES.filter((g) => g.category === cat.id);
        return (
          <div key={cat.id}>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">
              {cat.icon} {cat.label} <span className="opacity-60">— {cat.description}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gaits.map((gait) => {
                const localized = localizeGait(gait, lang);
                const isSelected = selected.id === gait.id;
                const colors = COLOR_MAP[gait.color];
                return (
                  <button
                    key={gait.id}
                    onClick={() => onSelect(gait)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                    style={{
                      backgroundColor: isSelected ? colors.bgLight : undefined,
                      borderColor: isSelected ? colors.border : 'transparent',
                      color: isSelected ? colors.text : undefined,
                    }}
                  >
                    {localized.name.split('(')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
