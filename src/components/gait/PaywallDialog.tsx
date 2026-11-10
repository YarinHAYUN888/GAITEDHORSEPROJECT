import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: string;
  remaining: number;
}

const TIERS = [
  {
    id: "free",
    icon: Zap,
    credits: 20,
    priceKey: "paywall.freePrice",
    features: ["paywall.freeF1", "paywall.freeF2"],
  },
  {
    id: "pro",
    icon: Star,
    credits: 100,
    priceKey: "paywall.proPrice",
    features: ["paywall.proF1", "paywall.proF2", "paywall.proF3"],
    highlight: true,
  },
  {
    id: "coach",
    icon: Crown,
    credits: 999,
    priceKey: "paywall.coachPrice",
    features: ["paywall.coachF1", "paywall.coachF2", "paywall.coachF3", "paywall.coachF4"],
  },
];

export default function PaywallDialog({ open, onOpenChange, currentTier, remaining }: Props) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-rubik">{t("paywall.title")}</DialogTitle>
          <DialogDescription>{t("paywall.description")}</DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground text-center mb-4">
          {t("paywall.remaining")}: <span className="font-bold text-foreground">{remaining}</span>
        </div>

        <div className="grid gap-4">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isCurrent = tier.id === currentTier;
            return (
              <div
                key={tier.id}
                className={`rounded-xl border p-4 transition-all ${
                  tier.highlight
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border"
                } ${isCurrent ? "ring-2 ring-primary/30" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-bold">{t(`paywall.${tier.id}`)}</span>
                    {isCurrent && <Badge variant="secondary" className="text-[10px]">{t("paywall.current")}</Badge>}
                  </div>
                  <span className="text-sm font-medium">{t(tier.priceKey)}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{tier.credits} {t("paywall.creditsLabel")}</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-1">
                      <span className="text-primary">✓</span> {t(f)}
                    </li>
                  ))}
                </ul>
                {!isCurrent && tier.id !== "free" && (
                  <Button size="sm" className="w-full mt-3" variant={tier.highlight ? "default" : "outline"}>
                    {t("paywall.upgrade")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
