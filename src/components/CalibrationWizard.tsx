import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ruler, Camera, ChevronRight, ChevronLeft, CheckCircle, AlertTriangle, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export interface CalibrationData {
  markerType: "checkerboard" | "aruco" | "ruler" | "horse_height" | "fence" | "none";
  pixelsPerMeter: number | null;
  cameraAngle: number; // degrees from perpendicular (0 = perfect 90°)
  confidence: number; // 0-100
  referenceLength: number | null; // cm of known object
  calibrationMethod: string;
}

interface CalibrationWizardProps {
  onCalibrationComplete: (data: CalibrationData) => void;
  horseHeightCm?: number;
}

const STEPS = [
  { id: "marker", title: "בחירת סמן כיול", description: "באיזה סמן אתה משתמש?" },
  { id: "measure", title: "מדידת הסמן", description: "הזן את גודל הסמן בפועל" },
  { id: "angle", title: "זווית מצלמה", description: "הערכת זווית הצילום" },
  { id: "done", title: "סיכום כיול", description: "הכיול הושלם" },
];

const MARKER_TYPES = [
  { id: "checkerboard" as const, label: "לוח שחמט / Checkerboard", icon: "♟️", desc: "הכי מדויק — הנח לוח שחמט מודפס ליד הסוס", refSize: 30 },
  { id: "aruco" as const, label: "סמן ARUco", icon: "🎯", desc: "סמן מודפס סטנדרטי — מדויק מאוד", refSize: 20 },
  { id: "ruler" as const, label: "סרגל / מטר", icon: "📏", desc: "מוט מדידה עם סימונים ידועים", refSize: 100 },
  { id: "fence" as const, label: "גדר מגרש", icon: "🏇", desc: "גדר אילוף סטנדרטית (~120 ס\"מ)", refSize: 120 },
  { id: "horse_height" as const, label: "גובה הסוס ידוע", icon: "🐴", desc: "השתמש בגובה הסוס בגריסטה ככיול", refSize: 0 },
  { id: "none" as const, label: "ללא סמן — דלג", icon: "⏭️", desc: "ניתוח ללא כיול (פחות מדויק)", refSize: 0 },
];

const CAMERA_ANGLES = [
  { value: 0, label: "90° מושלם — מול הסוס מהצד", quality: "מעולה" },
  { value: 10, label: "~80° — כמעט מהצד", quality: "טוב" },
  { value: 20, label: "~70° — מזווית קלה", quality: "סביר" },
  { value: 30, label: "~60° — מזווית ניכרת", quality: "חלש" },
  { value: 45, label: "~45° — מזווית חדה", quality: "גרוע" },
];

export default function CalibrationWizard({ onCalibrationComplete, horseHeightCm }: CalibrationWizardProps) {
  const [step, setStep] = useState(0);
  const [markerType, setMarkerType] = useState<CalibrationData["markerType"]>("none");
  const [referenceLength, setReferenceLength] = useState<string>("");
  const [cameraAngle, setCameraAngle] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);

  const selectedMarker = MARKER_TYPES.find(m => m.id === markerType);

  const computeCalibration = (): CalibrationData => {
    let refCm: number | null = null;
    let confidence = 0;
    let method = "";

    if (markerType === "none") {
      return { markerType, pixelsPerMeter: null, cameraAngle, confidence: 0, referenceLength: null, calibrationMethod: "ללא כיול" };
    }

    if (markerType === "horse_height") {
      refCm = horseHeightCm || (referenceLength ? parseFloat(referenceLength) : null);
      confidence = refCm ? Math.max(50, 85 - cameraAngle) : 0;
      method = `כיול לפי גובה סוס: ${refCm} ס"מ`;
    } else {
      refCm = referenceLength ? parseFloat(referenceLength) : selectedMarker?.refSize || null;
      const baseConfidence = markerType === "checkerboard" ? 95 : markerType === "aruco" ? 92 : markerType === "ruler" ? 85 : 70;
      confidence = Math.max(20, baseConfidence - cameraAngle);
      method = `כיול לפי ${selectedMarker?.label}: ${refCm} ס"מ`;
    }

    // Rough pixelsPerMeter estimate (actual calibration done by AI in edge function)
    const pixelsPerMeter = refCm ? Math.round(720 / (refCm / 100 * 2)) : null;

    return { markerType, pixelsPerMeter, cameraAngle, confidence, referenceLength: refCm, calibrationMethod: method };
  };

  const handleComplete = () => {
    const data = computeCalibration();
    onCalibrationComplete(data);
    setIsOpen(false);
  };

  const handleSkip = () => {
    onCalibrationComplete({
      markerType: "none", pixelsPerMeter: null, cameraAngle: 0, confidence: 0,
      referenceLength: null, calibrationMethod: "ללא כיול — המשתמש דילג",
    });
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)} className="w-full flex items-center gap-2 h-11">
        <Ruler className="h-4 w-4" />
        ערכת כיול וידאו (Calibration Kit)
        <Badge variant="outline" className="text-xs mr-auto">מומלץ</Badge>
      </Button>
    );
  }

  const calibration = computeCalibration();

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          ערכת כיול וידאו — שלב {step + 1}/{STEPS.length}
        </CardTitle>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {/* Step 0: Marker Selection */}
          {step === 0 && (
            <motion.div key="marker" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
              <p className="text-sm text-muted-foreground">הנח סמן בעל גודל ידוע ליד הסוס בזמן הצילום. זה מאפשר חישוב אורך צעד ומהירות במטרים.</p>
              <div className="grid gap-2">
                {MARKER_TYPES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMarkerType(m.id);
                      if (m.refSize > 0) setReferenceLength(String(m.refSize));
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-right transition-colors ${markerType === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    {markerType === m.id && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 1: Measurement */}
          {step === 1 && (
            <motion.div key="measure" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {markerType === "none" ? (
                <p className="text-sm text-muted-foreground">בחרת לדלג על הכיול. הניתוח יתבסס על הערכות יחסיות בלבד.</p>
              ) : markerType === "horse_height" ? (
                <div className="space-y-2">
                  <Label>גובה הסוס בגריסטה (ס"מ)</Label>
                  <Input
                    type="number" min={100} max={200}
                    value={horseHeightCm ? String(horseHeightCm) : referenceLength}
                    onChange={(e) => setReferenceLength(e.target.value)}
                    placeholder="לדוגמה: 150"
                    disabled={!!horseHeightCm}
                  />
                  {horseHeightCm && <p className="text-xs text-green-500">✓ גובה הסוס כבר הוזן: {horseHeightCm} ס"מ</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>אורך/גובה הסמן בפועל (ס"מ)</Label>
                  <Input
                    type="number" min={1} max={500}
                    value={referenceLength}
                    onChange={(e) => setReferenceLength(e.target.value)}
                    placeholder={`ברירת מחדל: ${selectedMarker?.refSize} ס"מ`}
                  />
                  <p className="text-xs text-muted-foreground">ודא שהסמן נראה בבירור בסרטון</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Camera Angle */}
          {step === 2 && (
            <motion.div key="angle" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
              <p className="text-sm text-muted-foreground">באיזו זווית צולם הסרטון ביחס לסוס?</p>
              <div className="space-y-2">
                {CAMERA_ANGLES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setCameraAngle(a.value)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-right transition-colors ${cameraAngle === a.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <span className="text-sm">{a.label}</span>
                    <Badge variant={a.value <= 10 ? "default" : a.value <= 20 ? "secondary" : "destructive"} className="text-xs">
                      {a.quality}
                    </Badge>
                  </button>
                ))}
              </div>
              {cameraAngle >= 30 && (
                <div className="flex items-center gap-2 text-yellow-500 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  זווית חדה מדי — מומלץ לצלם מחדש ב-90° לדיוק מיטבי
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Summary */}
          {step === 3 && (
            <motion.div key="done" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סמן כיול:</span>
                  <span className="font-medium">{selectedMarker?.label || "ללא"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">אורך ייחוס:</span>
                  <span className="font-medium">{calibration.referenceLength ? `${calibration.referenceLength} ס"מ` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">זווית מצלמה:</span>
                  <span className="font-medium">{90 - cameraAngle}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ביטחון כיול:</span>
                  <Badge variant={calibration.confidence >= 70 ? "default" : calibration.confidence >= 40 ? "secondary" : "destructive"}>
                    {calibration.confidence}%
                  </Badge>
                </div>
              </div>
              {calibration.confidence >= 70 && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> כיול איכותי — מדידות מוחלטות זמינות
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={step === 0 ? handleSkip : () => setStep(s => s - 1)}>
            {step === 0 ? "דלג" : <><ChevronRight className="h-4 w-4 ml-1" /> הקודם</>}
          </Button>
          {step < 3 ? (
            <Button size="sm" onClick={() => setStep(s => s + 1)}>
              הבא <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleComplete}>
              <CheckCircle className="h-4 w-4 ml-1" /> אשר כיול
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
