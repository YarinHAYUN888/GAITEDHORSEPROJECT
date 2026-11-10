import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCredits } from "@/services/creditService";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserCredits } from "@/types/pipeline";

export default function CreditBadge() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [credits, setCredits] = useState<UserCredits | null>(null);

  useEffect(() => {
    if (!user) return;
    getCredits(user.id).then(setCredits);
  }, [user]);

  if (!credits) return null;

  const isLow = credits.remaining <= 3;
  const variant = isLow ? "destructive" : "secondary";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1 cursor-default">
            <Coins className="h-3 w-3" />
            {credits.remaining}/{credits.total}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("credits.remaining")}: {credits.remaining}</p>
          <p className="text-xs text-muted-foreground">{t("credits.tier")}: {credits.tier}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
