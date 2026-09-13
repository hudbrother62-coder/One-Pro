import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigins = new Set([
  "https://one-pro-cyan.vercel.app",
  "http://localhost:4173",
  "http://terminal.local:4173",
]);

function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://one-pro-cyan.vercel.app",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "content-type": "application/json",
    "vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  if (token.length < 32) return json(req, { error: "Tautan undangan tidak valid" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const tokenHash = await sha256(token);
  const { data: invitation, error: inviteError } = await admin.from("invitations")
    .select("id,full_name,role,area_id,village_id,group_id,expires_at,accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (inviteError || !invitation || invitation.accepted_at || new Date(invitation.expires_at) <= new Date()) {
    return json(req, { error: "Undangan tidak ditemukan, kedaluwarsa, atau sudah dipakai" }, 404);
  }

  if (body.action === "inspect") {
    return json(req, { fullName: invitation.full_name, role: invitation.role, expiresAt: invitation.expires_at });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 8) {
    return json(req, { error: "Username tidak valid atau password kurang dari 8 karakter" }, 400);
  }

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin.from("invitations")
    .update({ accepted_at: claimedAt })
    .eq("id", invitation.id)
    .is("accepted_at", null)
    .gt("expires_at", claimedAt)
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) {
    return json(req, { error: "Undangan sudah dipakai atau kedaluwarsa" }, 409);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${username}@accounts.onepro.local`,
    password,
    email_confirm: true,
    user_metadata: { full_name: invitation.full_name, username },
  });
  if (createError || !created.user) {
    await admin.from("invitations").update({ accepted_at: null }).eq("id", invitation.id).eq("accepted_at", claimedAt);
    return json(req, { error: createError?.message ?? "Akun gagal dibuat" }, 400);
  }

  const { error: membershipError } = await admin.from("memberships").insert({
    user_id: created.user.id,
    role: invitation.role,
    area_id: invitation.area_id,
    village_id: invitation.village_id,
    group_id: invitation.group_id,
  });
  if (membershipError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("invitations").update({ accepted_at: null }).eq("id", invitation.id).eq("accepted_at", claimedAt);
    return json(req, { error: "Akses anggota gagal dibuat" }, 500);
  }

  return json(req, { accepted: true });
});
