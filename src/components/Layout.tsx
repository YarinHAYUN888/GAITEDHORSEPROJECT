import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Home, BookOpen, MessageCircle, FileText, Video, GraduationCap, ScanEye, LayoutDashboard, Music, Target, Shield, LogOut, Sun, Moon, Globe, Calendar, Users, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import HelpDialog from "@/components/HelpDialog";
import MobileBottomNav from "@/components/MobileBottomNav";
import HorseCoachChat from "@/components/HorseCoachChat";
import OfflineIndicator from "@/components/OfflineIndicator";
import PushPermissionBanner from "@/components/PushPermissionBanner";
import OnboardingTour from "@/components/OnboardingTour";
import CommandPalette from "@/components/CommandPalette";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useAppContent } from "@/hooks/useAppContent";

const NAV_KEYS = [
  { path: "/", key: "nav.home", icon: Home },
  { path: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { path: "/gait-analysis", key: "nav.gaitAnalysis", icon: Video },
  { path: "/conformation", key: "nav.conformation", icon: ScanEye },
  { path: "/breeds", key: "nav.breeds", icon: BookOpen },
  { path: "/dmrt3", key: "nav.dmrt3", icon: GraduationCap },
  { path: "/genetics-expert", key: "nav.geneticsExpert", icon: MessageCircle },
  { path: "/pedigree", key: "nav.pedigree", icon: FileText },
  { path: "/metronome", key: "nav.metronome", icon: Music },
  { path: "/training-calendar", key: "nav.calendar", icon: Calendar },
  { path: "/multi-compare", key: "nav.comparison", icon: Users },
  { path: "/training-pilot", key: "nav.trainingPilot", icon: Target },
  { path: "/gait-validator", key: "nav.gaitValidator", icon: Shield },
  { path: "/methodology", key: "nav.methodology", icon: FlaskConical },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, toggleLanguage, dir } = useLanguage();
  const { isAdmin } = useAdminAccess();
  const { data: content } = useAppContent();
  const announcement = lang === "he" ? content?.announcement_he : content?.announcement_en;
  const navItems = isAdmin ? [NAV_KEYS[0], NAV_KEYS[1], { path: "/admin", key: "admin", icon: Shield }, ...NAV_KEYS.slice(2)] : NAV_KEYS;

  // Mobile swipe navigation
  useSwipeNavigation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Focus trap for mobile nav
  useEffect(() => {
    if (!mobileOpen) return;
    const nav = mobileNavRef.current;
    if (!nav) return;
    const focusables = nav.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])');
    if (focusables.length) focusables[0].focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMobileOpen(false); return; }
      if (e.key !== "Tab" || !focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <a href="#main-content" className="skip-link">{t("nav.skipToContent")}</a>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-lg border-b border-border" role="banner">
        <div className="container flex items-center justify-between h-14 lg:h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label={`${t("app.name")} — ${t("nav.home")}`}>
            <span className="text-2xl" aria-hidden="true">🐴</span>
            <span className="text-lg lg:text-xl font-rubik font-bold text-gradient-gold">{t("app.name")}</span>
          </Link>

          {/* Desktop Nav */}
          <nav
            aria-label={t("nav.mainNav")}
            className="hidden lg:flex items-center gap-0.5 overflow-x-auto max-w-[calc(100vw-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  data-tour={item.path === "/gait-analysis" ? "nav-analysis" : item.path === "/dashboard" ? "nav-dashboard" : item.path === "/breeds" ? "nav-breeds" : undefined}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {item.key === "admin" ? (lang === "he" ? "ניהול מערכת" : "System management") : t(item.key)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <CommandPalette />
            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              aria-label={t("lang.switchTo")}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("lang.switchTo")}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </Button>
            {user && (
              <Button variant="ghost" size="sm" onClick={signOut} className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                {t("nav.signOut")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            >
              {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </header>

      {isAdmin && location.pathname !== "/admin" && (
        <div className="border-b border-primary/20 bg-primary/10">
          <div className="container flex items-center justify-between gap-3 py-2">
            <span className="text-sm font-medium text-foreground">{lang === "he" ? "מחובר כאדמין" : "Signed in as admin"}</span>
            <Button asChild variant="outline" className="min-h-11 gap-2 border-primary/30 text-primary shrink-0">
              <Link to="/admin"><Shield className="h-4 w-4" />{lang === "he" ? "ניהול מערכת" : "System management"}</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              id="mobile-nav"
              ref={mobileNavRef}
              role="dialog"
              aria-label={t("nav.mobileNavLabel")}
              initial={{ opacity: 0, x: dir === "rtl" ? 100 : -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir === "rtl" ? 100 : -100 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`fixed top-0 ${dir === "rtl" ? "left-0" : "right-0"} bottom-0 w-72 z-50 bg-card border-${dir === "rtl" ? "r" : "l"} border-border overflow-y-auto lg:hidden shadow-2xl`}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="text-lg font-rubik font-bold text-gradient-gold">{t("nav.menu")}</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label={t("nav.closeMenu")}>
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
              <nav aria-label={t("nav.mobileNavLabel")} className="p-3 flex flex-col gap-0.5">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[48px] ${
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted"
                      }`}
                    >
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {item.key === "admin" ? (lang === "he" ? "ניהול מערכת" : "System management") : t(item.key)}
                    </Link>
                  );
                })}
              </nav>
              {user && (
                <div className="p-3 border-t border-border">
                  <Button
                    variant="ghost"
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg min-h-[48px]"
                  >
                    <LogOut className="h-5 w-5" aria-hidden="true" />
                    {t("nav.signOut")}
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main id="main-content" tabIndex={-1} className={isMobile ? "pb-20" : ""}>
        {announcement && <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 text-sm text-foreground text-center break-words" role="status">{announcement}</div>}
        {children}
      </main>

      {/* Footer */}
      <footer className={`border-t border-border bg-card/50 py-10 ${isMobile ? "mb-16" : "mt-16"}`} role="contentinfo">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl" aria-hidden="true">🐴</span>
                <span className="font-rubik font-bold text-gradient-gold">{t("app.name")}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {t("app.tagline")}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t("footer.coreTools")}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/gait-analysis" className="hover:text-primary transition-colors">{t("footer.gaitAnalysisAI")}</Link></li>
                <li><Link to="/conformation" className="hover:text-primary transition-colors">{t("footer.conformationAnalysis")}</Link></li>
                <li><Link to="/dashboard" className="hover:text-primary transition-colors">{t("footer.dashboard")}</Link></li>
                <li><Link to="/metronome" className="hover:text-primary transition-colors">{t("footer.metronome")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t("footer.learning")}</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/dmrt3" className="hover:text-primary transition-colors">{t("footer.dmrt3Guide")}</Link></li>
                <li><Link to="/genetics-expert" className="hover:text-primary transition-colors">{t("footer.geneticsExpert")}</Link></li>
                <li><Link to="/conformation" className="hover:text-primary transition-colors">{t("footer.conformationAnalysis")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} {t("app.copyright")}</p>
          </div>
        </div>
      </footer>

      <MobileBottomNav />
      <HelpDialog />
      <HorseCoachChat />
      <PushPermissionBanner />
      <OnboardingTour />
    </div>
  );
}
