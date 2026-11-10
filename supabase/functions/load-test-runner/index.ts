import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_FRAME_URL =
  "https://xydojvnfzrnaglecwnbn.supabase.co/storage/v1/object/public/horse-photos/self-test%2Fandalusian.jpg";

interface ScenarioConfig {
  name: string;
  frames: string[];
  context?: Record<string, unknown>;
  expectSuccess: boolean;
  description: string;
}

async function frameUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch base frame: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());

  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}

function buildScenarios(frameToken: string): ScenarioConfig[] {
  const frames40 = Array(40).fill(frameToken);
  const frames60 = Array(60).fill(frameToken);
  const frames30 = Array(30).fill(frameToken);

  return [
    {
      name: "happy_path",
      frames: frames40,
      context: {
        breed: "standardbred",
        trainingLevel: "intermediate",
        analysisGoal: "general",
        audioMetrics: { bpm: 120, regularity: 0.85, snr: 25, beatPattern: "1-2-1-2" },
        calibrationData: { confidence: 65, cameraAngle: 12, pixelsPerMeter: 100 },
      },
      expectSuccess: true,
      description: "Full pipeline",
    },
    {
      name: "vision_only",
      frames: frames60,
      context: { breed: "tennessee-walker", analysisGoal: "performance" },
      expectSuccess: true,
      description: "Vision only",
    },
    {
      name: "audio_only_meta",
      frames: frames30,
      context: { audioMetrics: { bpm: 110, regularity: 0.9, snr: 30, beatPattern: "1-2-3-4" } },
      expectSuccess: true,
      description: "Audio metadata",
    },
    {
      name: "bad_audio",
      frames: frames30,
      context: { audioMetrics: { bpm: 60, regularity: 0.2, snr: 5, beatPattern: "irregular" } },
      expectSuccess: true,
      description: "Bad audio",
    },
    {
      name: "calibration_trusted",
      frames: frames40,
      context: { calibrationData: { confidence: 70, cameraAngle: 10, pixelsPerMeter: 120 } },
      expectSuccess: true,
      description: "Calibration trusted",
    },
    {
      name: "calibration_extreme",
      frames: frames40,
      context: { calibrationData: { confidence: 15, cameraAngle: 25, pixelsPerMeter: 50 } },
      expectSuccess: true,
      description: "Calibration extreme",
    },
    {
      name: "dmrt3_aa",
      frames: frames40,
      context: { dmrt3Genotype: "AA" },
      expectSuccess: true,
      description: "DMRT3 AA",
    },
    {
      name: "dmrt3_cc",
      frames: frames40,
      context: { dmrt3Genotype: "CC" },
      expectSuccess: true,
      description: "DMRT3 CC",
    },
    {
      name: "invalid_frames",
      frames: ["", "not-base64", "", frameToken, ""],
      context: {},
      expectSuccess: false,
      description: "Invalid frames",
    },
    {
      name: "empty_payload",
      frames: [],
      context: {},
      expectSuccess: false,
      description: "Empty frames",
    },
    {
      name: "horizon_abuse",
      frames: frames30,
      context: { forecastHorizonSec: 1000 },
      expectSuccess: true,
      description: "Horizon abuse",
    },
    {
      name: "large_batch",
      frames: Array(80).fill(frameToken),
      context: { breed: "standardbred", dmrt3Genotype: "CA" },
      expectSuccess: true,
      description: "Large batch",
    },
  ];
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let config: { scenarios?: number; concurrency?: number } = {};
    try {
      config = await req.json();
    } catch {
      // defaults
    }

    const maxScenarios = config.scenarios ?? 12;
    const concurrency = Math.min(config.concurrency ?? 5, 10);

    const { data: run, error: runErr } = await adminClient
      .from("load_test_runs")
      .insert({ user_id: user.id, config, status: "running" })
      .select("id")
      .single();

    if (runErr || !run) throw new Error(runErr?.message || "Failed to create run");

    const frameToken = await frameUrlToDataUrl(BASE_FRAME_URL);
    const scenarios = buildScenarios(frameToken).slice(0, maxScenarios);
    const runId = run.id;
    const gaitAnalysisUrl = `${supabaseUrl}/functions/v1/gait-analysis`;
    const results: any[] = [];

    const executeScenario = async (scenario: ScenarioConfig) => {
      const correlationId = crypto.randomUUID();
      const started = Date.now();
      let statusCode = 0;
      let success = false;
      let truncated = false;
      let errorMessage: string | null = null;
      let responseKeys: string[] = [];

      try {
        const response = await fetch(gaitAnalysisUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ frames: scenario.frames, ...scenario.context, _selfTest: true, _correlationId: correlationId }),
        });

        statusCode = response.status;
        const json = await response.json().catch(() => ({}));
        responseKeys = Object.keys(json || {});
        success = response.ok;
        truncated = !!json?.analysis?._truncated;
        errorMessage = typeof json?.error === "string" ? json.error : null;
      } catch (e) {
        errorMessage = e instanceof Error ? e.message : "Unknown error";
      }

      return {
        run_id: runId,
        scenario: scenario.name,
        status_code: statusCode,
        latency_ms: Date.now() - started,
        success,
        credit_charged: success && statusCode === 200,
        truncated,
        error_message: errorMessage,
        correlation_id: correlationId,
        metadata: {
          description: scenario.description,
          expectSuccess: scenario.expectSuccess,
          matchedExpectation: success === scenario.expectSuccess,
          responseKeys,
        },
      };
    };

    for (let i = 0; i < scenarios.length; i += concurrency) {
      const batch = scenarios.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(executeScenario));
      results.push(...batchResults);
    }

    if (results.length) await adminClient.from("load_test_results").insert(results);

    const latencies = results.map((r) => r.latency_ms as number);
    const failCount = results.filter((r) => !r.success).length;
    const successCount = results.length - failCount;
    const summary = {
      totalScenarios: results.length,
      successCount,
      failCount,
      errorRate: results.length ? failCount / results.length : 0,
      parseFailCount: results.filter((r) => r.error_message === "JSON parse failure").length,
      timeoutCount: results.filter((r) => r.status_code === 504).length,
      truncatedCount: results.filter((r) => r.truncated).length,
      truncationRate: results.length ? results.filter((r) => r.truncated).length / results.length : 0,
      matchedExpectations: results.filter((r) => r.metadata?.matchedExpectation).length,
      expectationAccuracy: results.length ? results.filter((r) => r.metadata?.matchedExpectation).length / results.length : 0,
      avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      latencyP50: percentile(latencies, 50),
      latencyP95: percentile(latencies, 95),
      latencyP99: percentile(latencies, 99),
    };

    await adminClient
      .from("load_test_runs")
      .update({ status: "completed", finished_at: new Date().toISOString(), summary })
      .eq("id", runId);

    return new Response(JSON.stringify({ runId, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
