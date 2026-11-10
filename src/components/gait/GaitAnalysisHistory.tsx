import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { History, Eye, Trash2, Scale, ShieldCheck, Shield, Share2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { GaitAnalysisResult } from "@/types/gait";
import { useLanguage } from "@/contexts/LanguageContext";

interface HistoryRecord {
  id: string;
  horse_name: string | null;
  horse_id: string | null;
  gait_type_hebrew: string | null;
  overall_score: number | null;
  lateral_sync_pct: number | null;
  symmetry_score: number | null;
  created_at: string;
  result_json: any;
  human_validated: boolean | null;
  analysis_mode: string | null;
  share_token: string | null;
}

interface HorseOption {
  id: string;
  name: string;
}

interface Props {
  refreshKey: number;
  onViewRecord: (result: GaitAnalysisResult, id?: string, humanValidated?: boolean, horseName?: string) => void;
  onCompare?: (result: GaitAnalysisResult, date?: string) => void;
  referenceId?: string;
}

export default function GaitAnalysisHistory({ refreshKey, onViewRecord, onCompare, referenceId }: Props) {
  const { t, lang } = useLanguage();
  const [filterHorseId, setFilterHorseId] = useState<string>("all");
  const [filterSeal, setFilterSeal] = useState<string>("all");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const SEAL_CONFIG: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
    gold: { label: "🥇 Gold", color: "text-primary", icon: ShieldCheck },
    silver: { label: "🥈 Silver", color: "text-muted-foreground", icon: ShieldCheck },
    bronze: { label: "🥉 Bronze", color: "text-primary", icon: Shield },
  };

  const MODE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    vision: { label: t("dash.modeVision"), variant: "outline" },
    audio: { label: t("dash.modeAudio"), variant: "outline" },
    both: { label: t("dash.modeBoth"), variant: "secondary" },
  };

  const dateLocale = lang === "he" ? "he-IL" : "en-US";

  const { data: horses = [] } = useQuery({
    queryKey: ["horses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("horses").select("id, name").order("name");
      return (data as HorseOption[]) ?? [];
    },
    staleTime: Infinity,
  });

  const { data: records = [], isLoading, error: historyError, refetch } = useQuery({
    queryKey: ["gait-history", refreshKey, filterHorseId, filterSeal],
    queryFn: async () => {
      let query = supabase
        .from("gait_analyses")
        .select("id, horse_name, horse_id, gait_type_hebrew, overall_score, lateral_sync_pct, symmetry_score, created_at, result_json, human_validated, analysis_mode, share_token")
        .order("created_at", { ascending: false })
        .limit(30);

      if (filterHorseId && filterHorseId !== "all") {
        query = query.eq("horse_id", filterHorseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      let results = (data as HistoryRecord[]) ?? [];
      // Client-side seal filter
      if (filterSeal !== "all") {
        results = results.filter(r => {
          const sealLevel = (r.result_json as any)?.qualitySealLevel;
          return sealLevel === filterSeal;
        });
      }
      return results;
    },
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("gait_analyses").delete().eq("id", id);
    if (error) {
      toast({ title: t("ghist.deleteError"), description: error.message, variant: "destructive" });
    } else {
      queryClient.setQueryData<HistoryRecord[]>(
        ["gait-history", refreshKey, filterHorseId, filterSeal],
        (old) => old?.filter((r) => r.id !== id) ?? []
      );
      toast({ title: t("ghist.deleteSuccess") });
    }
  };

  const handleShare = async (record: HistoryRecord) => {
    setSharingId(record.id);
    try {
      let token = record.share_token;
      if (!token) {
        token = crypto.randomUUID();
        const { error } = await supabase
          .from("gait_analyses")
          .update({ share_token: token } as any)
          .eq("id", record.id);
        if (error) throw error;
        // Update cache
        queryClient.setQueryData<HistoryRecord[]>(
          ["gait-history", refreshKey, filterHorseId, filterSeal],
          (old) => old?.map((r) => r.id === record.id ? { ...r, share_token: token } : r) ?? []
        );
      }
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: t("ghist.shareCopied") });
    } catch (e: any) {
      toast({ title: t("ghist.shareError"), description: e.message, variant: "destructive" });
    } finally {
      setSharingId(null);
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 py-12" role="status"><Loader2 className="h-5 w-5 animate-spin" />{lang === "he" ? "טוען היסטוריה" : "Loading history"}</div>;
  if (historyError) return <div className="py-8 space-y-3"><p className="text-destructive">{lang === "he" ? "לא ניתן לטעון היסטוריה" : "Could not load history"}</p><Button variant="outline" onClick={() => refetch()}>{lang === "he" ? "נסה שוב" : "Retry"}</Button></div>;

  return (
    <section className="mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> {t("ghist.title")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {horses.length > 0 && (
              <Select value={filterHorseId} onValueChange={setFilterHorseId}>
                <SelectTrigger className="w-full sm:w-48 min-h-11">
                  <SelectValue placeholder={t("ghist.filterPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("ghist.allHorses")}</SelectItem>
                  {horses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterSeal} onValueChange={setFilterSeal}>
              <SelectTrigger className="w-full sm:w-36 min-h-11">
                <SelectValue placeholder={t("ghist.filterSeal")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("ghist.allSeals")}</SelectItem>
                <SelectItem value="gold">🥇 Gold</SelectItem>
                <SelectItem value="silver">🥈 Silver</SelectItem>
                <SelectItem value="bronze">🥉 Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t("ghist.empty")}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ghist.date")}</TableHead>
                    <TableHead>{t("ghist.horse")}</TableHead>
                    <TableHead>{t("ghist.gaitType")}</TableHead>
                    <TableHead>{t("ghist.mode")}</TableHead>
                    <TableHead>{t("ghist.score")}</TableHead>
                    <TableHead>{t("ghist.sync")}</TableHead>
                    <TableHead>{t("ghist.symmetry")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.created_at).toLocaleDateString(dateLocale)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          {r.horse_name || "—"}
                          {r.human_validated && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                          {(() => { const sl = (r.result_json as any)?.qualitySealLevel; const sc = SEAL_CONFIG[sl as string]; return sc ? <span className={`text-xs ${sc.color}`} title={sc.label}>●</span> : null; })()}
                        </span>
                      </TableCell>
                      <TableCell>{(lang === "he" ? r.gait_type_hebrew : r.result_json?.gaitType?.replace(/_/g, " ")) || "—"}</TableCell>
                      <TableCell>
                        {(() => { const m = MODE_LABELS[r.analysis_mode || "both"]; return m ? <Badge variant={m.variant} className="text-xs">{m.label}</Badge> : "—"; })()}
                      </TableCell>
                      <TableCell>{r.overall_score ?? "—"}</TableCell>
                      <TableCell>{r.lateral_sync_pct != null ? `${r.lateral_sync_pct}%` : "—"}</TableCell>
                      <TableCell>{r.symmetry_score ?? "—"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" className="min-h-[44px] min-w-[44px]" aria-label={t("ghist.view")} onClick={() => { if (r.result_json) onViewRecord(r.result_json as GaitAnalysisResult, r.id, r.human_validated ?? false, r.horse_name || undefined); }}>
                          <Eye className="h-5 w-5" />
                        </Button>
                        {onCompare && (
                          <Button variant="ghost" className="min-h-[44px] min-w-[44px] text-primary" aria-label={t("ghist.compare")} onClick={() => { if (r.result_json) onCompare(r.result_json as GaitAnalysisResult, new Date(r.created_at).toLocaleDateString(dateLocale)); }}>
                            <Scale className="h-5 w-5" />
                          </Button>
                        )}
                        <Button variant="ghost" className="min-h-[44px] min-w-[44px]" aria-label={t("ghist.share")} onClick={() => handleShare(r)} disabled={sharingId === r.id}>
                          {sharingId === r.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive" aria-label={t("ghist.delete")}>
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("ghist.deleteTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("ghist.deleteDesc").replace("{name}", r.horse_name || t("ghist.defaultHorse")).replace("{date}", new Date(r.created_at).toLocaleDateString(dateLocale))}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("ghist.cancel")}</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(r.id)}>{t("ghist.delete")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {records.map((r) => (
                <div key={r.id} className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-1">
                      {r.horse_name || t("ghist.defaultHorse")}
                      {r.human_validated && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(dateLocale)}</span>
                  </div>
                  <div className="flex gap-3 text-sm items-center">
                    <span>{(lang === "he" ? r.gait_type_hebrew : r.result_json?.gaitType?.replace(/_/g, " ")) || "—"}</span>
                    {(() => { const m = MODE_LABELS[r.analysis_mode || "both"]; return m ? <Badge variant={m.variant} className="text-xs">{m.label}</Badge> : null; })()}
                    <span>{t("ghist.score")}: <strong>{r.overall_score ?? "—"}</strong></span>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" aria-label={t("ghist.view")} onClick={() => { if (r.result_json) onViewRecord(r.result_json as GaitAnalysisResult, r.id, r.human_validated ?? false, r.horse_name || undefined); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onCompare && (
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] text-primary" aria-label={t("ghist.compare")} onClick={() => { if (r.result_json) onCompare(r.result_json as GaitAnalysisResult, new Date(r.created_at).toLocaleDateString(dateLocale)); }}>
                        <Scale className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" aria-label={t("ghist.share")} onClick={() => handleShare(r)} disabled={sharingId === r.id}>
                      {sharingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] text-destructive" aria-label={t("ghist.delete")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("ghist.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("ghist.deleteDescShort").replace("{name}", r.horse_name || t("ghist.defaultHorse"))}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("ghist.cancel")}</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(r.id)}>{t("ghist.delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </section>
  );
}
