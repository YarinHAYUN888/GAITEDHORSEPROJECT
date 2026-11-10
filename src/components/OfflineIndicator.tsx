import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getQueueSize, flushQueue } from "@/lib/offlineSync";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const goOffline = () => { setIsOffline(true); setPendingCount(getQueueSize()); };
    const goOnline = () => {
      setSyncing(true);
      flushQueue().then(() => {
        setPendingCount(getQueueSize());
        setSyncing(false);
        setTimeout(() => setIsOffline(false), 1500);
      });
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed top-14 inset-x-0 z-[60] flex items-center justify-center gap-2 py-2 px-4 bg-destructive text-destructive-foreground text-sm font-medium"
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          <span>
            {syncing
              ? t("offline.syncing") || "מסנכרן נתונים..."
              : `${t("offline.noConnection") || "אין חיבור לאינטרנט"}${pendingCount > 0 ? ` · ${pendingCount} ${t("offline.pending") || "בתור"}` : ""}`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
