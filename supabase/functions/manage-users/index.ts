import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigins = new Set([
  "https://one-pro-cyan.vercel.app",
  "http://localhost:4173",
  "http://terminal.local:4173",
]);

type Role = "super_admin" | "admin_daerah" | "admin_desa" | "pj_kelompok" | "pengajar";
type Scope = { areaId?: string | null; villageId?: string | null; groupId?: string | null };
type Membership = { user_id: string; role: Role; area_id: string | null; village_id: string | null; group_id: string | null; is_active: boolean };

function response(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://one-pro-cyan.vercel.app",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "content-type": "application/json",
      "vary": "Origin",
    },
  });
}

function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: response(req, {}).headers });
  if (req.method !== "POST") return response(req, { error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return response(req, { error: "Sesi login tidak ditemukan" }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.slice(7);
  const { data: actorAuth, error: actorError } = await admin.auth.getUser(token);
  if (actorError || !actorAuth.user) return response(req, { error: "Sesi login tidak valid" }, 401);
  const actorId = actorAuth.user.id;

  const { data: actorMemberships, error: actorMembershipError } = await admin.from("memberships")
    .select("user_id,role,area_id,village_id,group_id,is_active")
    .eq("user_id", actorId)
    .eq("is_active", true);
  if (actorMembershipError || !actorMemberships?.length) return response(req, { error: "Akun tidak memiliki akses aktif" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "record-login") {
    const now = new Date().toISOString();
    await admin.from("profiles").update({ last_login_at: now, updated_at: now }).eq("id", actorId);
    await admin.from("audit_logs").insert({
      actor_id: actorId,
      action: "user_login",
      entity_type: "user",
      entity_id: actorId,
      scope: { user_agent: String(req.headers.get("user-agent") ?? "").slice(0, 240) },
    });
    return response(req, { success: true });
  }

  const targetRole = String(body.role ?? "") as Role;
  const scope: Scope = { areaId: body.areaId || null, villageId: body.villageId || null, groupId: body.groupId || null };

  async function resolvedScope(input: Scope) {
    let areaId = input.areaId ?? null;
    let villageId = input.villageId ?? null;
    const groupId = input.groupId ?? null;
    if (groupId) {
      const { data: group } = await admin.from("groups").select("village_id,villages!inner(area_id)").eq("id", groupId).single();
      villageId = group?.village_id ?? null;
      areaId = (group?.villages as unknown as { area_id?: string } | null)?.area_id ?? null;
    } else if (villageId) {
      const { data: village } = await admin.from("villages").select("area_id").eq("id", villageId).single();
      areaId = village?.area_id ?? null;
    }
    return { areaId, villageId, groupId };
  }

  function canManage(actor: Membership, role: Role, target: Awaited<ReturnType<typeof resolvedScope>>) {
    if (!actor.is_active || role === "super_admin") return false;
    if (actor.role === "super_admin") return true;
    if (actor.role === "admin_daerah") {
      return actor.area_id === target.areaId && ["admin_desa", "pj_kelompok", "pengajar"].includes(role);
    }
    if (actor.role === "admin_desa") {
      return actor.village_id === target.villageId && ["pj_kelompok", "pengajar"].includes(role);
    }
    return actor.role === "pj_kelompok" && role === "pengajar" && actor.group_id === target.groupId;
  }

  async function authorize(role: Role, targetScope: Scope) {
    const target = await resolvedScope(targetScope);
    const allowed = (actorMemberships as Membership[]).some((membership) => canManage(membership, role, target));
    return { allowed, target };
  }

  async function audit(actionName: string, targetId: string, details: Record<string, unknown> = {}) {
    await admin.from("audit_logs").insert({ actor_id: actorId, action: actionName, entity_type: "user", entity_id: targetId, after_data: details });
  }

  if (action === "create") {
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const authorization = await authorize(targetRole, scope);
    if (!authorization.allowed) return response(req, { error: "Anda tidak boleh membuat akun pada lingkup tersebut" }, 403);
    if (!validUsername(username) || password.length < 6 || !fullName) return response(req, { error: "Nama, username valid, dan password minimal 6 karakter wajib diisi" }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${username}@accounts.onepro.local`,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username },
    });
    if (createError || !created.user) return response(req, { error: createError?.message ?? "Akun gagal dibuat" }, 400);

    const membership = {
      user_id: created.user.id,
      role: targetRole,
      area_id: targetRole === "admin_daerah" ? authorization.target.areaId : null,
      village_id: targetRole === "admin_desa" ? authorization.target.villageId : null,
      group_id: ["pj_kelompok", "pengajar"].includes(targetRole) ? authorization.target.groupId : null,
    };
    const { error: membershipError } = await admin.from("memberships").insert(membership);
    if (membershipError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return response(req, { error: "Akun dibuat tetapi lingkup akses gagal dipasang" }, 500);
    }
    await audit("user_created", created.user.id, { username, role: targetRole, ...authorization.target });
    return response(req, { success: true, userId: created.user.id });
  }

  const targetId = String(body.userId ?? "");
  if (!targetId || targetId === actorId) return response(req, { error: "Akun ini tidak dapat dikelola dari tindakan tersebut" }, 400);
  const { data: targetMembership } = await admin.from("memberships")
    .select("user_id,role,area_id,village_id,group_id,is_active")
    .eq("user_id", targetId)
    .limit(1)
    .maybeSingle();
  if (!targetMembership || targetMembership.role === "super_admin") return response(req, { error: "Akun tujuan tidak dapat dikelola" }, 403);
  const currentAuthorization = await authorize(targetMembership.role as Role, {
    areaId: targetMembership.area_id,
    villageId: targetMembership.village_id,
    groupId: targetMembership.group_id,
  });
  if (!currentAuthorization.allowed) return response(req, { error: "Akun berada di luar lingkup akses Anda" }, 403);

  if (action === "status") {
    const active = Boolean(body.active);
    const { error: authError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: active ? "none" : "876000h" });
    if (authError) return response(req, { error: authError.message }, 400);
    await admin.from("memberships").update({ is_active: active }).eq("user_id", targetId);
    await admin.from("profiles").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", targetId);
    await audit(active ? "user_activated" : "user_deactivated", targetId, { active });
    return response(req, { success: true });
  }

  if (action === "update") {
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    if (!validUsername(username) || !fullName || (password && password.length < 6)) return response(req, { error: "Nama dan username wajib valid; password baru minimal 6 karakter" }, 400);
    const { data: oldProfile } = await admin.from("profiles").select("username,full_name").eq("id", targetId).single();
    const authUpdate: Record<string, unknown> = { email: `${username}@accounts.onepro.local`, user_metadata: { full_name: fullName, username } };
    if (password) authUpdate.password = password;
    const { error: authError } = await admin.auth.admin.updateUserById(targetId, authUpdate);
    if (authError) return response(req, { error: authError.message }, 400);
    const { error: profileError } = await admin.from("profiles").update({ username, full_name: fullName, updated_at: new Date().toISOString() }).eq("id", targetId);
    if (profileError) {
      await admin.auth.admin.updateUserById(targetId, { email: `${oldProfile?.username}@accounts.onepro.local`, user_metadata: { full_name: oldProfile?.full_name, username: oldProfile?.username } });
      return response(req, { error: profileError.message }, 400);
    }
    await audit("user_updated", targetId, { username, fullName, passwordChanged: Boolean(password) });
    return response(req, { success: true });
  }

  if (action === "delete") {
    await audit("user_deleted", targetId, { role: targetMembership.role });
    const { error } = await admin.auth.admin.deleteUser(targetId);
    if (error) return response(req, { error: error.message }, 400);
    return response(req, { success: true });
  }

  return response(req, { error: "Tindakan tidak dikenali" }, 400);
});
