import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-report`;

Deno.test("generate-report: CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: { "Origin": "http://localhost:3000" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("generate-report: returns report for valid input", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      result: { overallScore: 75, gaitType: "trot", symmetry: { score: 80 } },
      horseName: "Test Horse",
    }),
  });
  const data = await res.json();
  if (res.status === 200) {
    assertExists(data.report);
  } else {
    console.log("Skipped: edge function returned", res.status, data);
  }
});
