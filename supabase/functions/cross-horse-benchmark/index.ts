import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analysisId, breedId } = await req.json();
    const svc = createClient(supabaseUrl, supabaseKey);

    // Get the target analysis
    const { data: target } = await svc.from("gait_analyses")
      .select("overall_score, symmetry_score, confidence, gait_type, breed_id, lateral_sync_pct")
      .eq("id", analysisId)
      .single();

    if (!target) throw new Error("Analysis not found");

    const filterBreed = breedId || target.breed_id;

    // Get all analyses for benchmarking (same breed or all)
    let query = svc.from("gait_analyses")
      .select("overall_score, symmetry_score, confidence, lateral_sync_pct")
      .not("overall_score", "is", null);

    if (filterBreed) {
      query = query.eq("breed_id", filterBreed);
    }

    const { data: allAnalyses } = await query.limit(1000);
    const pool = allAnalyses || [];

    if (pool.length < 3) {
      return new Response(JSON.stringify({
        percentiles: null,
        sampleSize: pool.length,
        message: "לא מספיק נתונים להשוואה (נדרשים לפחות 3 ניתוחים)",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    function percentileRank(arr: number[], value: number): number {
      const below = arr.filter(v => v < value).length;
      return Math.round((below / arr.length) * 100);
    }

    const scores = pool.map(a => a.overall_score).filter((v): v is number => v != null);
    const symScores = pool.map(a => a.symmetry_score).filter((v): v is number => v != null);
    const confScores = pool.map(a => a.confidence).filter((v): v is number => v != null);
    const lateralScores = pool.map(a => a.lateral_sync_pct).filter((v): v is number => v != null);

    const percentiles: Record<string, number | null> = {
      overallScore: target.overall_score != null ? percentileRank(scores, target.overall_score) : null,
      symmetryScore: target.symmetry_score != null ? percentileRank(symScores, target.symmetry_score) : null,
      confidence: target.confidence != null ? percentileRank(confScores, target.confidence) : null,
      lateralSync: target.lateral_sync_pct != null ? percentileRank(lateralScores, target.lateral_sync_pct) : null,
    };

    const avgOverall = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const avgSymmetry = symScores.length ? symScores.reduce((a, b) => a + b, 0) / symScores.length : null;

    return new Response(JSON.stringify({
      percentiles,
      sampleSize: pool.length,
      breedId: filterBreed,
      averages: {
        overallScore: avgOverall ? Math.round(avgOverall * 10) / 10 : null,
        symmetryScore: avgSymmetry ? Math.round(avgSymmetry * 10) / 10 : null,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cross-horse-benchmark error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
