import { useState, useEffect } from "react";
import { CheckCircle, Camera, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const CHECKLIST_ITEMS = [
  { id: "angle", label: "הסוס ב-90 מעלות למצלמה (מבט צדי מלא)" },
  { id: "surface", label: "משטח שטוח ואחיד" },
  { id: "noise", label: "ללא רעש רקע חזק (רוח, מכונות)" },
  { id: "distance", label: "מרחק 3-5 מטר מהסוס" },
];

export interface CaptureQuality {
  score: number; // 0-4
  label: string;
  color: string;
  checks: Record<string, boolean>;
}

interface GuidedCaptureProps {
  onQualityChange?: (quality: CaptureQuality) => void;
}

export default function GuidedCapture({ onQualityChange }: GuidedCaptureProps) {
  const [isFirstVisit] = useState(() => {
    const visited = localStorage.getItem("gait-guided-visited");
    if (!visited) localStorage.setItem("gait-guided-visited", "true");
    return !visited;
  });
  const [open, setOpen] = useState(isFirstVisit);
  const [checks, setChecks] = useState<Record<string, boolean>>({
    angle: false, surface: false, noise: false, distance: false,
  });

  const score = Object.values(checks).filter(Boolean).length;
  const qualityLabel = score >= 4 ? "מצוין" : score >= 3 ? "טוב" : score >= 2 ? "סביר" : "חלש";
  const qualityColor = score >= 4 ? "bg-green-500" : score >= 3 ? "bg-green-400" : score >= 2 ? "bg-yellow-500" : "bg-destructive";

  useEffect(() => {
    onQualityChange?.({ score, label: qualityLabel, color: qualityColor, checks });
  }, [score]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            מדריך צילום — לתוצאות מדויקות
            {score > 0 && (
              <Badge className={`${qualityColor} text-white text-xs`}>{score}/4 — {qualityLabel}</Badge>
            )}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 space-y-4">
        {/* SVG Guide Overlay */}
        <div className="relative bg-muted/30 rounded-xl p-4 border border-border">
          <svg viewBox="0 0 400 200" className="w-full max-w-md mx-auto" xmlns="http://www.w3.org/2000/svg">
            {/* Ground line */}
            <line x1="20" y1="170" x2="380" y2="170" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="6,4" />
            <text x="385" y="174" fill="hsl(var(--muted-foreground))" fontSize="8" textAnchor="end">קרקע</text>

            {/* Horse silhouette (simplified) */}
            <ellipse cx="200" cy="110" rx="70" ry="35" fill="hsl(var(--muted-foreground))" opacity="0.15" />
            <ellipse cx="155" cy="80" rx="20" ry="15" fill="hsl(var(--muted-foreground))" opacity="0.15" />
            {/* Legs */}
            <line x1="160" y1="145" x2="155" y2="170" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.3" />
            <line x1="180" y1="145" x2="175" y2="170" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.3" />
            <line x1="220" y1="145" x2="225" y2="170" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.3" />
            <line x1="240" y1="145" x2="245" y2="170" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.3" />

            {/* Height reference */}
            <line x1="310" y1="70" x2="310" y2="170" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="4,3" />
            <text x="320" y="125" fill="hsl(var(--primary))" fontSize="8">גובה</text>

            {/* 90° indicator */}
            <line x1="50" y1="30" x2="50" y2="180" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5" />
            <text x="55" y="25" fill="hsl(var(--primary))" fontSize="9" fontWeight="bold">90°</text>
            <text x="55" y="35" fill="hsl(var(--muted-foreground))" fontSize="7">זווית מצלמה</text>

            {/* Distance */}
            <line x1="50" y1="185" x2="200" y2="185" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3,3" />
            <text x="125" y="196" fill="hsl(var(--primary))" fontSize="8" textAnchor="middle">3-5 מטר</text>
          </svg>
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <Checkbox
                id={`capture-${item.id}`}
                checked={checks[item.id]}
                onCheckedChange={(checked) => setChecks((prev) => ({ ...prev, [item.id]: checked === true }))}
              />
              <Label htmlFor={`capture-${item.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                {checks[item.id] && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                {item.label}
              </Label>
            </div>
          ))}
        </div>

        {score < 3 && (
          <p className="text-xs text-yellow-500">
            ⚠️ לתוצאות מדויקות, מומלץ לסמן לפחות 3 מתוך 4 סעיפים
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
