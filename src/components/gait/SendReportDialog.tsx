import { useState } from "react";
import { Send, Mail, Copy, Check, Loader2, MessageSquare, Phone, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { callEdgeFunction } from "@/services/edgeFunctionClient";

interface SendReportDialogProps {
  analysisId?: string;
  horseName?: string;
}

export default function SendReportDialog({ analysisId, horseName }: SendReportDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [trainerEmail, setTrainerEmail] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateReport = async () => {
    if (!analysisId) {
      toast.error("חסר מזהה ניתוח");
      return;
    }
    setIsGenerating(true);
    try {
      const data = await callEdgeFunction<{ report: string }>("send-analysis-report", {
        analysisId,
        format: "markdown",
      });
      setReport(data.report);
      toast.success("הדוח נוצר בהצלחה");
    } catch (err: any) {
      toast.error(err.message || "שגיאה ביצירת הדוח");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success("הדוח הועתק ללוח");
    setTimeout(() => setCopied(false), 2000);
  };

  const buildReportText = () => {
    if (!report) return "";
    const greeting = trainerName ? `שלום ${trainerName},\n\n` : "שלום,\n\n";
    const note = personalNote ? `${personalNote}\n\n---\n\n` : "";
    return `${greeting}${note}${report}`;
  };

  const handleSendEmail = () => {
    if (!report) return;
    const subject = encodeURIComponent(`דוח ניתוח תנועה${horseName ? ` — ${horseName}` : ""}`);
    const body = encodeURIComponent(buildReportText());
    window.open(`mailto:${trainerEmail}?subject=${subject}&body=${body}`, "_blank");
    toast.success("נפתח בתוכנת המייל");
  };

  const sanitizePhone = (raw: string): string => {
    return raw.replace(/[^\d+]/g, "").slice(0, 20);
  };

  const handleSendWhatsApp = () => {
    if (!report) return;
    const cleanPhone = sanitizePhone(phoneNumber);
    const text = encodeURIComponent(
      `📊 *דוח ניתוח תנועה${horseName ? ` — ${horseName}` : ""}*\n\n${buildReportText()}`
    );
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
    toast.success("נפתח ב-WhatsApp");
  };

  const handleSendSMS = () => {
    if (!report || !phoneNumber) return;
    const cleanPhone = sanitizePhone(phoneNumber);
    // Shorter version for SMS
    const shortReport = report.split("\n").slice(0, 15).join("\n");
    const body = encodeURIComponent(
      `דוח ניתוח תנועה${horseName ? ` — ${horseName}` : ""}\n\n${shortReport}\n\n(דוח מלא זמין באפליקציה)`
    );
    window.open(`sms:${cleanPhone}?body=${body}`, "_self");
    toast.success("נפתחה אפליקציית ההודעות");
  };

  const handleNativeShare = async () => {
    if (!report) return;
    try {
      await navigator.share({
        title: `דוח ניתוח תנועה${horseName ? ` — ${horseName}` : ""}`,
        text: buildReportText(),
      });
      toast.success("הדוח שותף בהצלחה");
    } catch {
      // User cancelled or not supported
      handleCopy();
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !report) {
      generateReport();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={!analysisId}>
          <Send className="h-3.5 w-3.5" />
          שלח דוח
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            שליחת דוח ניתוח
          </DialogTitle>
          <DialogDescription>
            הפקת דוח מקצועי מפורט ושליחתו למאמן או וטרינר במייל, SMS או WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Recipient Details */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trainer-name">שם הנמען</Label>
              <Input
                id="trainer-name"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                placeholder="ד״ר ישראלי"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">טלפון (SMS/WhatsApp)</Label>
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+972501234567"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trainer-email">אימייל</Label>
            <Input
              id="trainer-email"
              type="email"
              value={trainerEmail}
              onChange={(e) => setTrainerEmail(e.target.value)}
              placeholder="trainer@example.com"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personal-note">הערה אישית (אופציונלי)</Label>
            <Textarea
              id="personal-note"
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder="מצורף דוח ניתוח תנועה לעיונך..."
              rows={2}
            />
          </div>

          {/* Report Preview */}
          {isGenerating && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>מפיק דוח מקצועי...</span>
            </div>
          )}

          {report && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>תצוגה מקדימה</Label>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "הועתק" : "העתק"}
                </Button>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto text-xs font-mono whitespace-pre-wrap leading-relaxed border">
                {report.slice(0, 1500)}{report.length > 1500 ? "\n\n..." : ""}
              </div>
            </div>
          )}

          {/* Send Channels */}
          {report && (
            <Tabs defaultValue="whatsapp" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </TabsTrigger>
                <TabsTrigger value="email" className="gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  מייל
                </TabsTrigger>
                <TabsTrigger value="sms" className="gap-1.5 text-xs">
                  <Phone className="h-3.5 w-3.5" />
                  SMS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="whatsapp" className="pt-3">
                <Button onClick={handleSendWhatsApp} disabled={!report} className="w-full gap-2 bg-primary hover:bg-primary/90">
                  <MessageSquare className="h-4 w-4" />
                  שלח ב-WhatsApp
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  {phoneNumber ? "ישלח ישירות למספר" : "ייפתח בחירת איש קשר"}
                </p>
              </TabsContent>

              <TabsContent value="email" className="pt-3">
                <Button onClick={handleSendEmail} disabled={!report || !trainerEmail} className="w-full gap-2">
                  <Mail className="h-4 w-4" />
                  שלח במייל
                </Button>
                {!trainerEmail && (
                  <p className="text-xs text-destructive mt-1.5 text-center">הזן כתובת מייל למעלה</p>
                )}
              </TabsContent>

              <TabsContent value="sms" className="pt-3">
                <Button onClick={handleSendSMS} disabled={!report || !phoneNumber} variant="outline" className="w-full gap-2">
                  <Phone className="h-4 w-4" />
                  שלח ב-SMS
                </Button>
                {!phoneNumber && (
                  <p className="text-xs text-destructive mt-1.5 text-center">הזן מספר טלפון למעלה</p>
                )}
                <p className="text-xs text-muted-foreground mt-1 text-center">גרסה מקוצרת (הדוח המלא באפליקציה)</p>
              </TabsContent>
            </Tabs>
          )}

          {/* Fallback actions */}
          <div className="flex gap-2">
            {typeof navigator.share === "function" && (
              <Button variant="outline" size="sm" onClick={handleNativeShare} disabled={!report} className="flex-1 gap-2">
                <Share2 className="h-3.5 w-3.5" />
                שתף
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!report} className="flex-1 gap-2">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "הועתק!" : "העתק דוח"}
            </Button>
          </div>

          {!report && !isGenerating && (
            <Button onClick={generateReport} variant="secondary" className="w-full gap-2">
              <Loader2 className="h-4 w-4" />
              נסה שנית
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
