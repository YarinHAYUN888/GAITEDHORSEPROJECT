import { useState } from "react";
import { Download, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function GDPRExport() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const exportAllData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const tables = ["horses", "gait_analyses", "conformation_records", "training_logs", "health_records", "horse_videos"] as const;
      const allData: Record<string, unknown[]> = {};

      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select("*")
          .eq("user_id", user.id);
        allData[table] = data || [];
      }

      // Profile
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      allData["profile"] = profile ? [profile] : [];

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `susitsa-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t("gdpr.exportSuccess"));
    } catch (err) {
      toast.error(t("gdpr.exportError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-rubik">
          <Shield className="h-5 w-5 text-primary" />
          {t("gdpr.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("gdpr.description")}</p>
        <Button onClick={exportAllData} disabled={loading} variant="outline" className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Download className="h-4 w-4 ml-2" />}
          {t("gdpr.downloadAll")}
        </Button>
      </CardContent>
    </Card>
  );
}
