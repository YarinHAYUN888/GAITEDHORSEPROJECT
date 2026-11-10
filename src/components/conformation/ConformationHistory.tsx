import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConformationResult } from "./ConformationResults";
import { useLanguage } from "@/contexts/LanguageContext";

interface HistoryRecord {
  id: string;
  horse_name: string | null;
  breed_id: string | null;
  overall_balance: number | null;
  suitability_score: number | null;
  created_at: string;
  result_json: any;
}

interface Props {
  refreshKey: number;
  onViewRecord: (result: ConformationResult, suitabilityScore: number) => void;
}

export default function ConformationHistory({ refreshKey, onViewRecord }: Props) {
  const { t, lang } = useLanguage();
  const dateLocale = lang === "he" ? "he-IL" : "en-US";

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["conformation-history", refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("conformation_records" as any)
        .select("id, horse_name, breed_id, overall_balance, suitability_score, created_at, result_json")
        .order("created_at", { ascending: false })
        .limit(20);
      return ((data as unknown) as HistoryRecord[]) ?? [];
    },
  });

  if (isLoading) return null;
  if (records.length === 0) {
    return (
      <Card className="mt-8">
        <CardContent className="p-6 text-center text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{t("chist.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> {t("chist.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("chist.date")}</TableHead>
              <TableHead>{t("chist.horse")}</TableHead>
              <TableHead>{t("chist.balance")}</TableHead>
              <TableHead>{t("chist.suitability")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.created_at).toLocaleDateString(dateLocale)}</TableCell>
                <TableCell>{r.horse_name || "—"}</TableCell>
                <TableCell>{r.overall_balance ?? "—"}</TableCell>
                <TableCell>{r.suitability_score ?? "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    className="min-h-[44px] min-w-[44px]"
                    aria-label={t("chist.view").replace("{name}", r.horse_name || "—")}
                    onClick={() => {
                      if (r.result_json) {
                        onViewRecord(r.result_json as ConformationResult, r.suitability_score ?? 0);
                      }
                    }}
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
