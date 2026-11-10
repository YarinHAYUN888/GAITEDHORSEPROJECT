import { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Video, BookOpen, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const NAV_KEYS = [
  { path: "/", icon: Home, key: "mobile.home" },
  { path: "/gait-analysis", icon: Video, key: "mobile.analysis" },
  { path: "/dashboard", icon: LayoutDashboard, key: "mobile.center" },
  { path: "/breeds", icon: BookOpen, key: "mobile.breeds" },
] as const;

export default memo(function MobileBottomNav() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { t, lang } = useLanguage();
  const { isAdmin } = useAdminAccess();
  const items = isAdmin ? [...NAV_KEYS, { path: "/admin", icon: ShieldCheck, key: "admin" }] : NAV_KEYS;

  if (!isMobile) return null;

  return (
    <nav
      aria-label={t("nav.mobileNav")}
      className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {items.map(({ path, icon: Icon, key }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] rounded-lg transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} aria-hidden="true" />
              <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : ""}`}>
                {key === "admin" ? (lang === "he" ? "ניהול" : "Admin") : t(key)}
              </span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
});
