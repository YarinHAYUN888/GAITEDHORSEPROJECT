import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { breeds, BREED_CATEGORIES, getBreedsByCategory, type Breed } from "@/data/breeds";
import { ChevronLeft, ChevronRight, Dna, Star, Mountain, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function RatingDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < value ? "bg-primary" : "bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

function DmrtBadge({ genotype }: { genotype: Breed["dmrt3Genotype"] }) {
  const colorMap: Record<string, string> = {
    AA: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    "AA/CA": "bg-amber-500/15 text-amber-600 border-amber-500/30",
    CA: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    CC: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${colorMap[genotype] ?? colorMap.CC}`}>
      <Dna className="h-2.5 w-2.5" />
      {genotype}
    </span>
  );
}

function BreedCard({ breed, lang }: { breed: Breed; lang: string }) {
  const ChevronIcon = lang === "he" ? ChevronLeft : ChevronRight;

  return (
    <Link to={`/breeds/${breed.id}`} className="block group">
      <div className="glass-card overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 h-full">
        <div className="h-52 overflow-hidden relative">
          <img
            src={breed.image}
            alt={lang === "he" ? breed.nameHe : breed.nameEn}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className={`absolute inset-0 bg-gradient-to-t ${breed.color} opacity-30`} />
          <div className="absolute bottom-0 right-0 left-0 p-4 flex items-end justify-between">
            <span className="text-xs bg-background/80 backdrop-blur-sm text-foreground/80 px-2 py-1 rounded-full font-medium border border-border/30">
              {breed.origin}
            </span>
            <DmrtBadge genotype={breed.dmrt3Genotype} />
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-lg font-rubik font-bold group-hover:text-primary transition-colors leading-tight">
              {lang === "he" ? breed.nameHe : breed.nameEn}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{lang === "he" ? breed.nameEn : breed.nameHe}</p>

          {/* Primary gait badge */}
          <Badge variant="secondary" className="text-[10px] mb-3">
            {breed.primaryGait}
          </Badge>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{breed.description}</p>

          {/* Gaits */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {breed.gaits.slice(0, 3).map((gait) => (
              <span key={gait} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{gait}</span>
            ))}
            {breed.gaits.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{breed.gaits.length - 3}</span>
            )}
          </div>

          {/* Ratings */}
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mb-3">
            <div className="space-y-0.5">
              <span>נוחות</span>
              <RatingDots value={breed.rideComfort} />
            </div>
            <div className="space-y-0.5">
              <span>שטח</span>
              <RatingDots value={breed.trailSuitability} />
            </div>
            <div className="space-y-0.5">
              <span>תצוגה</span>
              <RatingDots value={breed.showSuitability} />
            </div>
          </div>

          {/* Specs */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 mb-3">
            <span>{breed.heightRange}</span>
            <span>•</span>
            <span>{breed.lifespan}</span>
          </div>

          <div className="flex items-center text-sm text-primary font-medium">
            מידע מלא
            <ChevronIcon className="h-4 w-4 mx-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function BreedEncyclopedia() {
  const { t, lang } = useLanguage();

  return (
    <div className="py-12">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">{t("breed.title")}</h1>
          <p className="text-muted-foreground text-lg mb-2">{t("breed.subtitle").replace("{count}", String(breeds.length))}</p>
          <p className="text-sm text-muted-foreground/70 max-w-2xl mx-auto">
            מידע מקיף על גנטיקת DMRT3, סוגי צעד, מקור והיסטוריה — מסודר לפי רלוונטיות לעולם סוסי הצעד
          </p>
        </motion.div>

        {/* Category sections */}
        {BREED_CATEGORIES.map((cat) => {
          const categoryBreeds = getBreedsByCategory(cat.key);
          if (categoryBreeds.length === 0) return null;

          return (
            <section key={cat.key} className="mb-14">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{cat.icon}</span>
                  <h2 className="text-xl md:text-2xl font-rubik font-bold text-foreground">
                    {lang === "he" ? cat.labelHe : cat.labelEn}
                  </h2>
                  <Badge variant="outline" className="text-[10px]">
                    {categoryBreeds.length}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mr-10">
                  {lang === "he" ? cat.descHe : cat.descEn}
                </p>
              </motion.div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className={`grid gap-6 ${
                  categoryBreeds.length <= 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {categoryBreeds.map((breed) => (
                  <motion.div key={breed.id} variants={itemVariants}>
                    <BreedCard breed={breed} lang={lang} />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
