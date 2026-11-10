import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, User, Award, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export type ExpertiseLevel = "beginner" | "intermediate" | "expert";

const STORAGE_KEY = "horse-app-expertise-level";

export function useExpertiseLevel(): [ExpertiseLevel, (level: ExpertiseLevel) => void] {
  const [level, setLevel] = useState<ExpertiseLevel>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as ExpertiseLevel) || "intermediate";
  });

  const update = (newLevel: ExpertiseLevel) => {
    setLevel(newLevel);
    localStorage.setItem(STORAGE_KEY, newLevel);
  };

  return [level, update];
}

interface Props {
  onComplete: (level: ExpertiseLevel) => void;
}

export default function SmartOnboarding({ onComplete }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<ExpertiseLevel>("intermediate");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const dismissed = localStorage.getItem(STORAGE_KEY + "-dismissed");
    if (!stored && !dismissed) {
      setShow(true);
    }
  }, []);

  const handleSubmit = () => {
    localStorage.setItem(STORAGE_KEY, selected);
    localStorage.setItem(STORAGE_KEY + "-dismissed", "true");
    onComplete(selected);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY + "-dismissed", "true");
    setShow(false);
  };

  if (!show) return null;

  const options = [
    {
      value: "beginner" as const,
      icon: User,
      title: "מתחיל",
      desc: "רוכב/בעלים שרוצה להבין את הסוס שלו טוב יותר. אראה לך הסברים פשוטים ותובנות מעשיות.",
    },
    {
      value: "intermediate" as const,
      icon: GraduationCap,
      title: "מאמן / חובבן מנוסה",
      desc: "מכיר את סוגי הצעדים ומונחי הביומכניקה הבסיסיים. אציג מדדים מפורטים והמלצות אימון.",
    },
    {
      value: "expert" as const,
      icon: Award,
      title: "מומחה / וטרינר",
      desc: "רוצה נתונים גולמיים, VSI, GRF, ודוחות קליניים מלאים. כל המדדים המתקדמים פתוחים.",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <Card className="max-w-md w-full">
            <CardHeader className="relative">
              <Button variant="ghost" size="icon" className="absolute top-2 end-2 h-7 w-7" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
              <CardTitle className="text-center">
                <span className="text-3xl block mb-2">🐴</span>
                ברוך הבא{user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ""}!
              </CardTitle>
              <p className="text-sm text-center text-muted-foreground">
                מהי רמת הניסיון שלך עם סוסי צעד?
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={selected} onValueChange={(v) => setSelected(v as ExpertiseLevel)}>
                {options.map(opt => (
                  <Label
                    key={opt.value}
                    htmlFor={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selected === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value={opt.value} id={opt.value} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{opt.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>

              <Button className="w-full" onClick={handleSubmit}>
                בוא נתחיל! 🚀
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                תוכל לשנות את הרמה בכל עת מההגדרות
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
