import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canSuspendAccount } from "./policy.ts";

Deno.serve(async (req) => {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ error: "Service unavailable" }, 503);
  const authorization = req.headers.get("Authorization") ?? "";
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401);
  const { data: allowed, error: roleError } = await client.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
  if (roleError || !allowed) return reply({ error: "Admin required" }, 403);
  try {
    const body = await req.json();
    const db = createClient(url, service);
    if (body.action === "set_suspended") {
      if (typeof body.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId) || typeof body.suspended !== "boolean") return reply({ error: "Invalid input" }, 400);
      const { data: targetAdmin, error: targetError } = await db.rpc("has_role", { _user_id: body.userId, _role: "admin" });
      if (targetError) throw targetError;
      if (!canSuspendAccount(auth.user.id, body.userId, Boolean(targetAdmin))) return reply({ error: "Administrator accounts cannot be suspended here" }, 400);
      const { error: updateError } = await db.auth.admin.updateUserById(body.userId, { ban_duration: body.suspended ? "876000h" : "none" });
      if (updateError) throw updateError;
      const { error: auditError } = await db.from("admin_audit_log").insert({ user_id: auth.user.id, action: body.suspended ? "suspend_account" : "restore_account", target_type: "user", target_id: body.userId });
      if (auditError) return reply({ error: "Account updated but audit recording failed. Refresh to verify account status." }, 500);
      return reply({ success: true });
    }
    if (body.action !== "overview") return reply({ error: "Invalid action" }, 400);
    const [users, roles, credits, invites, audit, horses, analyses] = await Promise.all([
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      db.from("user_roles").select("user_id,role"),
      db.from("analysis_credits").select("user_id,tier,credits_remaining,credits_total"),
      db.from("allowed_emails").select("id,email,created_at").order("created_at", { ascending: false }),
      db.from("admin_audit_log").select("id,action,target_type,target_id,created_at,user_id,metadata").order("created_at", { ascending: false }).limit(100),
      db.from("horses").select("id", { count: "exact", head: true }),
      db.from("gait_analyses").select("id", { count: "exact", head: true }),
    ]);
    if ([users, roles, credits, invites, audit, horses, analyses].some(r => r.error)) throw new Error("Unable to load administration data");
    return reply({ users: users.data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, suspended: Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now()), confirmed: Boolean(u.email_confirmed_at), admin: roles.data?.some(r => r.user_id === u.id && r.role === "admin"), credits: credits.data?.find(c => c.user_id === u.id) ?? null })), invites: invites.data, audit: audit.data, horseCount: horses.count, analysisCount: analyses.count, usersLimited: users.data.users.length >= 1000 });
  } catch {
    return reply({ error: "Unable to load administration data" }, 500);
  }
});