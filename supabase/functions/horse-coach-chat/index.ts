import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, horseId } = await req.json();

    // Gather horse context (RAG)
    let context = "";

    if (horseId) {
      const svc = createClient(supabaseUrl, supabaseKey);

      // Horse details
      const { data: horse } = await svc.from("horses").select("*").eq("id", horseId).eq("user_id", user.id).single();
      if (horse) {
        context += `\n## פרטי הסוס\nשם: ${horse.name}\nגזע: ${horse.breed_id || "לא ידוע"}\nDMRT3: ${horse.dmrt3_genotype || "לא ידוע"}\nגובה: ${horse.height_cm || "?"}cm\nשנת לידה: ${horse.birth_year || "?"}\nמין: ${horse.sex || "?"}\n`;
      }

      // Last 10 gait analyses
      const { data: analyses } = await svc.from("gait_analyses")
        .select("created_at, gait_type, overall_score, symmetry_score, confidence, lameness_risk, beat_pattern, notes")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (analyses?.length) {
        context += `\n## היסטוריית ניתוחי תנועה (${analyses.length} אחרונים)\n`;
        for (const a of analyses) {
          context += `- ${a.created_at?.slice(0, 10)}: ${a.gait_type || "?"} | ציון: ${a.overall_score ?? "?"} | סימטריה: ${a.symmetry_score ?? "?"} | ביטחון: ${a.confidence ?? "?"} | צליעה: ${a.lameness_risk || "תקין"} | תבנית: ${a.beat_pattern || "?"}\n`;
        }
      }

      // Training logs
      const { data: training } = await svc.from("training_logs")
        .select("date, type, duration_minutes, description, ai_recommendations")
        .eq("horse_id", horseId)
        .order("date", { ascending: false })
        .limit(10);

      if (training?.length) {
        context += `\n## יומן אימונים (${training.length} אחרונים)\n`;
        for (const t of training) {
          context += `- ${t.date}: ${t.type} (${t.duration_minutes || "?"}דק) — ${t.description || ""}\n`;
        }
      }

      // Conformation records
      const { data: conf } = await svc.from("conformation_records")
        .select("created_at, overall_balance, shoulder_angle, suitability_score, strengths, weaknesses, recommendation")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (conf?.length) {
        context += `\n## ניתוחי מבנה גוף\n`;
        for (const c of conf) {
          context += `- ${c.created_at?.slice(0, 10)}: איזון=${c.overall_balance ?? "?"} | כתף=${c.shoulder_angle ?? "?"} | התאמה=${c.suitability_score ?? "?"}\n  חוזקות: ${(c.strengths as string[])?.join(", ") || "?"}\n  חולשות: ${(c.weaknesses as string[])?.join(", ") || "?"}\n`;
        }
      }

      // Health records
      const { data: health } = await svc.from("health_records")
        .select("date, type, description, provider, notes")
        .eq("horse_id", horseId)
        .order("date", { ascending: false })
        .limit(5);

      if (health?.length) {
        context += `\n## רשומות בריאות\n`;
        for (const h of health) {
          context += `- ${h.date}: ${h.type} — ${h.description} (${h.provider || ""})\n`;
        }
      }
    }

    const systemPrompt = `אתה מאמן סוסים מומחה בעל ניסיון רב בסוסי צעד (Gaited Horses), ביומכניקה וגנטיקה (DMRT3).
אתה מדבר בעברית טבעית ומקצועית. אתה מכיר את כל סוגי הצעדים: Tölt, Pace, Fox Trot, Running Walk, Singlefoot, ועוד.

הנה הנתונים שיש לך על הסוס הנוכחי:
${context || "אין סוס נבחר כרגע. בקש מהמשתמש לבחור סוס."}

הנחיות:
- ענה תמיד בעברית
- התבסס על הנתונים שקיבלת כדי לתת תשובות מותאמות אישית
- אם שואלים שאלה שאין לך נתונים לגביה — אמור זאת בכנות
- תן המלצות מעשיות וקונקרטיות
- השתמש בטרמינולוגיה מקצועית אבל הסבר אותה
- אם זיהית מגמה בנתונים (שיפור/הידרדרות) — ציין אותה`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד דקה" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "נגמרו הקרדיטים. יש להוסיף קרדיטים בהגדרות." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("horse-coach-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
