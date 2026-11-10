import { useState } from "react";
import { Copy, Gift, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { triggerHaptic } from "@/hooks/useSwipeNavigation";

export default function ReferralCard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  // Generate a simple referral code from user id
  const code = user?.id ? `SUSITSA-${user.id.slice(0, 6).toUpperCase()}` : "—";

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    triggerHaptic("success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-rubik">
          <Gift className="h-5 w-5 text-primary" />
          {t("referral.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("referral.desc")}</p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
          <code className="flex-1 text-center font-mono text-lg font-bold text-primary">{code}</code>
          <Button variant="ghost" size="icon" onClick={copyCode}>
            {copied ? <CheckCircle className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        {copied && <p className="text-xs text-center text-primary">{t("referral.copied")}</p>}
        <Badge variant="secondary" className="w-full justify-center py-1.5">{t("referral.reward")}</Badge>
      </CardContent>
    </Card>
  );
}
