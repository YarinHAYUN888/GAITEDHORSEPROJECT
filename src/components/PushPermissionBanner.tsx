import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPushSupported, requestPushPermission, getPushPermissionState } from "@/lib/pushNotifications";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PushPermissionBanner() {
  const [show, setShow] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!isPushSupported()) return;
    const state = getPushPermissionState();
    const dismissed = localStorage.getItem("push_banner_dismissed");
    if (state === "default" && !dismissed) {
      const timer = setTimeout(() => setShow(true), 10000); // Show after 10s
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  const handleAllow = async () => {
    await requestPushPermission();
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("push_banner_dismissed", "1");
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 bg-card border border-border rounded-xl p-4 shadow-xl animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t("push.title")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("push.description")}</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleAllow} className="text-xs">{t("push.allow")}</Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs">{t("push.dismiss")}</Button>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
