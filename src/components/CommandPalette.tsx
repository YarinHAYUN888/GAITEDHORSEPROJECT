import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home, LayoutDashboard, Video, ScanEye, BookOpen, GraduationCap,
  MessageCircle, FileText, Music, Target, Shield, Search,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHorses } from "@/hooks/useHorses";

const PAGE_ITEMS = [
  { path: "/", key: "nav.home", icon: Home },
  { path: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { path: "/gait-analysis", key: "nav.gaitAnalysis", icon: Video },
  { path: "/conformation", key: "nav.conformation", icon: ScanEye },
  { path: "/breeds", key: "nav.breeds", icon: BookOpen },
  { path: "/dmrt3", key: "nav.dmrt3", icon: GraduationCap },
  { path: "/genetics-expert", key: "nav.geneticsExpert", icon: MessageCircle },
  { path: "/pedigree", key: "nav.pedigree", icon: FileText },
  { path: "/metronome", key: "nav.metronome", icon: Music },
  { path: "/training-calendar", key: "nav.calendar", icon: Target },
  { path: "/multi-compare", key: "nav.comparison", icon: Search },
  { path: "/training-pilot", key: "nav.trainingPilot", icon: Target },
  { path: "/gait-validator", key: "nav.gaitValidator", icon: Shield },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { horses } = useHorses();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const pageItems = useMemo(
    () => PAGE_ITEMS.map((p) => ({ ...p, label: t(p.key) })),
    [t]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/50 text-muted-foreground text-xs hover:bg-muted transition-colors"
        aria-label={t("cmd.searchPlaceholder")}
      >
        <Search className="h-3.5 w-3.5" />
        <span>{t("cmd.search")}</span>
        <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("cmd.searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("cmd.noResults")}</CommandEmpty>

          <CommandGroup heading={t("cmd.pages")}>
            {pageItems.map((item) => (
              <CommandItem key={item.path} onSelect={() => go(item.path)}>
                <item.icon className="ml-2 mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {horses.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("cmd.horses")}>
                {horses.map((horse) => (
                  <CommandItem
                    key={horse.id}
                    onSelect={() => go(`/horse/${horse.id}`)}
                  >
                    <span className="ml-2 mr-2 text-base">🐴</span>
                    <span>{horse.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
