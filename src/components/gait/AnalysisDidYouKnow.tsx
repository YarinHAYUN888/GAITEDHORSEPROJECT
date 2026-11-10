import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Fact {
  title: string;
  body: string;
  emoji: string;
}

const FACTS: Fact[] = [
  {
    emoji: "🧬",
    title: "מוטציית DMRT3 — הגן שמאפשר צעדים מיוחדים",
    body: "מוטציה בגן DMRT3 משנה את התיאום העצבי בחוט השדרה ומאפשרת לסוסים לבצע צעדים ייחודיים כמו Tölt ו-Pace. ללא המוטציה, רוב הסוסים מוגבלים ל-Walk, Trot ו-Canter.",
  },
  {
    emoji: "🐴",
    title: "מהו גזע הסטנדרדברד?",
    body: "הסטנדרדברד הוא גזע אמריקאי שפותח למרוצי ריתמה. הוא מתחלק לשני סוגים: Trotter (צעד אלכסוני) ו-Pacer (צעד לטרלי). ה-Pacer מהיר יותר ונפוץ ב-80% מהמרוצים בצפון אמריקה.",
  },
  {
    emoji: "🦶",
    title: "4 פעימות vs 2 פעימות",
    body: "צעד Walk הוא 4 פעימות עם סדר קבוע: אחורית שמאל → קדמית שמאל → אחורית ימין → קדמית ימין. צעד Trot הוא 2 פעימות — זוגות אלכסוניים פוגעים בקרקע ביחד.",
  },
  {
    emoji: "🇮🇸",
    title: "הסוס האיסלנדי — 5 צעדים ייחודיים",
    body: "הסוס האיסלנדי הוא הגזע היחיד שמבצע 5 צעדים טבעיים: Walk, Trot, Canter, Tölt ו-Flying Pace. ה-Tölt מאפשר רכיבה נוחה במהירויות גבוהות בזכות היעדר שלב ריחוף.",
  },
  {
    emoji: "📐",
    title: "סנכרון לטרלי vs אלכסוני",
    body: "אחוז הסנכרון הלטרלי מודד את הקשר בין רגליים באותו צד. 100% = Pace טהור (לטרלי מלא), 0% = Trot טהור (אלכסוני מלא). ערכים באמצע מצביעים על צעדים ייחודיים כמו Tölt או Rack.",
  },
  {
    emoji: "⚡",
    title: "Flying Pace — הצעד המהיר ביותר",
    body: "ב-Flying Pace שתי הרגליים באותו צד זזות ביחד, עם שלב ריחוף מלא. הסוס יכול להגיע למהירות של 45 קמ\"ש! זהו צעד שנמשך רק מספר שניות במרוצים.",
  },
  {
    emoji: "🔬",
    title: "איך עובד ניתוח התנועה?",
    body: "המערכת מחלצת פריימים מהסרטון, מזהה 16 נקודות אנטומיות על גוף הסוס, מחשבת זוויות מפרקים ותזמוני נחיתה, ומסווגת את סוג הצעד באמצעות אלגוריתמים ביומכניים ו-AI.",
  },
  {
    emoji: "🏇",
    title: "Paso Fino — צעד מטבע לידה",
    body: "סוסי Paso Fino נולדים עם צעד 4 פעימות טבעי שווה-מרווח (Classic Fino) שאינו מלומד. המהירות משתנה (Fino, Corto, Largo) אך הדפוס נשאר קבוע — זו תכונה גנטית טהורה.",
  },
  {
    emoji: "📊",
    title: "Beat Evenness — מדד האיכות המרכזי",
    body: "Beat Evenness מודד עד כמה הפעימות מרווחות באופן שווה. ערך של 1.0 אומר שכל הפעימות זהות בתזמון — סימן לצעד נקי ואיכותי. ערכים מתחת ל-0.7 מעידים על חוסר סדירות.",
  },
  {
    emoji: "🩺",
    title: "זיהוי צליעה באמצעות סימטריה",
    body: "אסימטריה של מעל 15% בין צד ימין לשמאל עלולה להעיד על צליעה. המערכת מנתחת את תנודות הראש והאגן כדי לזהות חוסר סימטריה — שיטה המבוססת על מחקר וטרינרי מתקדם.",
  },
  {
    emoji: "🌍",
    title: "סוסי Mangalarga Marchador",
    body: "גזע ברזילאי שמבצע צעד Marcha — 4 פעימות עם שני סוגים: Marcha Batida (נטייה אלכסונית, נוח יותר) ו-Marcha Picada (נטייה לטרלית, חלק יותר). הגזע השלישי בגודלו בעולם.",
  },
  {
    emoji: "🎵",
    title: "ניתוח אודיו — האוזן הדיגיטלית",
    body: "המערכת מנתחת את קול הפרסות כדי לזהות BPM (פעימות לדקה) וסדירות. שילוב האודיו עם הווידאו מאפשר אימות צולב — אם שני הערוצים מסכימים, רמת הביטחון עולה משמעותית.",
  },
];

const ROTATE_INTERVAL = 8000; // 8 seconds per fact

export default memo(function AnalysisDidYouKnow() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * FACTS.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % FACTS.length);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const fact = FACTS[index];

  const prev = () => setIndex((i) => (i - 1 + FACTS.length) % FACTS.length);
  const next = () => setIndex((i) => (i + 1) % FACTS.length);

  return (
    <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-primary">הידעת?</span>
        <span className="text-[10px] text-muted-foreground mr-auto">{index + 1}/{FACTS.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">{fact.emoji}</span>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-foreground mb-1">{fact.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{fact.body}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-center gap-2 mt-3">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prev}>
          <ChevronRight className="h-3 w-3" />
        </Button>
        <div className="flex items-center gap-1">
          {FACTS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={next}>
          <ChevronLeft className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});
