import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Activity } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { he, enUS } from "date-fns/locale";

interface TrainingLog {
  id: string;
  horse_id: string | null;
  date: string;
  type: string;
  description: string | null;
  duration_minutes: number | null;
  notes: string | null;
}

interface Horse {
  id: string;
  name: string;
}

export default function TrainingCalendar() {
  const { t, dir, lang } = useLanguage();
  const { user } = useAuth();
  const locale = lang === "he" ? he : enUS;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedHorse, setSelectedHorse] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: horses = [] } = useQuery({
    queryKey: ["calendar-horses"],
    queryFn: async () => {
      const { data } = await supabase.from("horses").select("id, name").order("name");
      return (data || []) as Horse[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["calendar-logs", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const start = startOfMonth(currentMonth).toISOString().split("T")[0];
      const end = endOfMonth(currentMonth).toISOString().split("T")[0];
      const { data } = await supabase
        .from("training_logs")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });
      return (data || []) as TrainingLog[];
    },
  });

  const filteredLogs = useMemo(
    () => selectedHorse === "all" ? logs : logs.filter((l) => l.horse_id === selectedHorse),
    [logs, selectedHorse]
  );

  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  }), [currentMonth]);

  const startDayOffset = getDay(startOfMonth(currentMonth));

  const dayLogs = (day: Date) => filteredLogs.filter((l) => isSameDay(new Date(l.date), day));

  const selectedDayLogs = selectedDay ? dayLogs(selectedDay) : [];

  const horseName = (id: string | null) => horses.find((h) => h.id === id)?.name || "—";

  const WEEKDAYS = lang === "he"
    ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="container py-8 space-y-6" dir={dir}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-rubik font-bold text-gradient-gold flex items-center gap-2">
            <Calendar className="h-7 w-7" />
            {t("calendar.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("calendar.subtitle")}</p>
        </div>
        <Select value={selectedHorse} onValueChange={setSelectedHorse}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("calendar.allHorses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("calendar.allHorses")}</SelectItem>
            {horses.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            {dir === "rtl" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
          <CardTitle className="text-xl font-rubik">
            {format(currentMonth, "MMMM yyyy", { locale })}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            {dir === "rtl" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const count = dayLogs(day).length;
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`relative p-2 rounded-lg text-sm transition-colors min-h-[44px] ${
                    isSelected ? "bg-primary text-primary-foreground" :
                    isToday ? "bg-accent/20 text-foreground" :
                    "hover:bg-muted text-foreground"
                  }`}
                >
                  {day.getDate()}
                  {count > 0 && (
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day details */}
      {selectedDay && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-rubik flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {format(selectedDay, "dd MMMM yyyy", { locale })}
              <Badge variant="secondary">{selectedDayLogs.length} {t("calendar.sessions")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDayLogs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">{t("calendar.noSessions")}</p>
            ) : (
              <div className="space-y-3">
                {selectedDayLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{log.type}</Badge>
                        {log.duration_minutes && (
                          <span className="text-xs text-muted-foreground">{log.duration_minutes} {t("calendar.minutes")}</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{log.description || "—"}</p>
                      <p className="text-xs text-muted-foreground mt-1">🐴 {horseName(log.horse_id)}</p>
                      {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
