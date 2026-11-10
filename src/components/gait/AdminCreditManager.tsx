import { useState, useEffect } from "react";
import { RefreshCw, Users, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreditRow {
  id: string;
  user_id: string;
  credits_remaining: number;
  credits_total: number;
  tier: string;
  reset_at: string | null;
  updated_at: string | null;
  display_name?: string;
  email?: string;
}

const TIER_CREDITS: Record<string, number> = { free: 20, pro: 100, coach: 999 };

export default function AdminCreditManager() {
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("analysis_credits")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("שגיאה בטעינת קרדיטים");
      setLoading(false);
      return;
    }

    // Enrich with profile names
    const userIds = (data ?? []).map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));

    setRows(
      (data ?? []).map((r: any) => ({
        ...r,
        display_name: profileMap.get(r.user_id) || r.user_id.slice(0, 8),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRenew = async (row: CreditRow) => {
    setRefreshingId(row.id);
    const total = TIER_CREDITS[row.tier] ?? 20;
    const { error } = await supabase
      .from("analysis_credits")
      .update({
        credits_remaining: total,
        credits_total: total,
        reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      toast.error("שגיאה בחידוש: " + error.message);
    } else {
      toast.success(`קרדיטים חודשו ל-${total} עבור ${row.display_name}`);
      await fetchAll();
    }
    setRefreshingId(null);
  };

  const handleTierChange = async (row: CreditRow, newTier: string) => {
    const total = TIER_CREDITS[newTier] ?? 20;
    const { error } = await supabase
      .from("analysis_credits")
      .update({
        tier: newTier,
        credits_remaining: total,
        credits_total: total,
        reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      toast.error("שגיאה בשינוי טייר: " + error.message);
    } else {
      toast.success(`טייר שונה ל-${newTier} עבור ${row.display_name}`);
      await fetchAll();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
          טוען...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" />
          ניהול קרדיטים — {rows.length} משתמשים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border bg-card"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{row.display_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={row.credits_remaining <= 3 ? "destructive" : "secondary"} className="gap-1 text-xs">
                  <Coins className="w-3 h-3" />
                  {row.credits_remaining}/{row.credits_total}
                </Badge>
                <span className="text-xs text-muted-foreground">טייר: {row.tier}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={row.tier} onValueChange={(v) => handleTierChange(row, v)}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8"
                disabled={refreshingId === row.id}
                onClick={() => handleRenew(row)}
              >
                <RefreshCw className={`w-3 h-3 ${refreshingId === row.id ? "animate-spin" : ""}`} />
                חדש
              </Button>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">אין משתמשים עם קרדיטים</p>
        )}
      </CardContent>
    </Card>
  );
}
