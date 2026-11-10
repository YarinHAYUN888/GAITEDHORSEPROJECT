import { useState, forwardRef } from "react";
import { HelpCircle, X, Keyboard, BarChart3, Calculator, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const helpSections = [
  {
    icon: BarChart3,
    title: "ניתוח תנועה",
    body: "העלו סרטון של הסוס בתנועה. המערכת תנתח את סוג הצעד, סימטריה ואיכות — כולל ציון FEIF.",
  },
  {
    icon: LayoutDashboard,
    title: "מרכז בקרה",
    body: "מבט-על על כל סוסי האורווה: ציונים, התראות ביומכניות, ומגמות לאורך זמן.",
  },
  {
    icon: Calculator,
    title: "מחשבון גנטי",
    body: "חשבו הסתברויות גנוטיפ DMRT3 לצאצאים על סמך הורים.",
  },
  {
    icon: Keyboard,
    title: "ניווט במקלדת",
    body: 'ניתן לנווט בכל האפליקציה בעזרת Tab, Enter ומקשי חצים. לחצו Tab בהתחלה כדי להגיע ל"דלג לתוכן".',
  },
];

const HelpDialog = forwardRef<HTMLDivElement>(function HelpDialog(_props, _ref) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="עזרה"
        className="fixed bottom-20 left-4 z-40 h-12 w-12 rounded-full shadow-lg bg-card border-border hover:bg-muted hover:scale-105 transition-transform md:bottom-4"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-rubik">
              עזרה — סוסי צעד
            </DialogTitle>
            <DialogDescription>
              מידע מהיר על השימוש באפליקציה
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {helpSections.map((s) => (
              <div key={s.title} className="flex gap-3 items-start">
                <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-primary/10">
                  <s.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    {s.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default HelpDialog;
