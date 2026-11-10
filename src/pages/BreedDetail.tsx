import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { breeds } from "@/data/breeds";
import { ChevronRight, Dna, Heart, History, Footprints, Ruler, Weight, Clock, Star, Mountain, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

function RatingBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-16 text-start">{label}</span>
      <Progress value={(value / max) * 100} className="h-2 flex-1" />
      <span className="text-xs font-mono text-muted-foreground w-6 text-end">{value}/{max}</span>
    </div>
  );
}

export default function BreedDetail() {
  const { id } = useParams();
  const breed = breeds.find((b) => b.id === id);

  if (!breed) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">גזע לא נמצא</h1>
        <Link to="/breeds" className="text-primary hover:underline">חזרה לאנציקלופדיה</Link>
      </div>
    );
  }

  const dmrt3Color: Record<string, string> = {
    AA: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    "AA/CA": "bg-amber-500/15 text-amber-600 border-amber-500/30",
    CA: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    CC: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="py-8">
      <div className="container max-w-4xl">
        {/* Breadcrumb */}
        <Link to="/breeds" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ChevronRight className="h-4 w-4" />
          חזרה לאנציקלופדיה
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Hero Image */}
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden mb-8">
            <img src={breed.image} alt={breed.nameHe} className="w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-t ${breed.color} opacity-50`} />
            <div className="absolute bottom-0 right-0 left-0 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">{breed.primaryGait}</Badge>
                <span className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded border ${dmrt3Color[breed.dmrt3Genotype] ?? dmrt3Color.CC}`}>
                  <Dna className="h-3 w-3" />
                  DMRT3: {breed.dmrt3Genotype}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-rubik font-bold text-white drop-shadow-lg">{breed.nameHe}</h1>
              <p className="text-white/80 text-lg">{breed.nameEn} • {breed.origin}</p>
            </div>
          </div>

          {/* Quick specs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { icon: Ruler, label: "גובה", value: breed.heightRange },
              { icon: Weight, label: "משקל", value: breed.weightRange },
              { icon: Clock, label: "תוחלת חיים", value: breed.lifespan },
              { icon: Footprints, label: "צעד ראשי", value: breed.primaryGait },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="glass-card p-3 text-center">
                <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Full Description */}
          <div className="glass-card p-6 mb-6">
            <p className="text-base text-foreground leading-relaxed">
              {breed.descriptionLong || breed.description}
            </p>
          </div>

          {/* Suitability Ratings */}
          <div className="glass-card p-6 mb-6">
            <h2 className="text-lg font-rubik font-bold mb-4">התאמה</h2>
            <div className="space-y-3">
              <RatingBar label="נוחות" value={breed.rideComfort} />
              <RatingBar label="שטח" value={breed.trailSuitability} />
              <RatingBar label="תצוגה" value={breed.showSuitability} />
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gaits */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Footprints className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-rubik font-bold">סוגי צעד</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {breed.gaits.map((gait) => (
                  <span key={gait} className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
                    {gait}
                  </span>
                ))}
              </div>
            </div>

            {/* DMRT3 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Dna className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-rubik font-bold">גנטיקת DMRT3</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{breed.dmrt3}</p>
            </div>

            {/* Temperament */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-rubik font-bold">אופי ומזג</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{breed.temperament}</p>
            </div>

            {/* History */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-rubik font-bold">היסטוריה</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{breed.history}</p>
            </div>
          </div>

          {/* Characteristics */}
          <div className="glass-card p-6 mt-6">
            <h2 className="text-lg font-rubik font-bold mb-4">תכונות עיקריות</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {breed.characteristics.map((char) => (
                <div key={char} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  {char}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
