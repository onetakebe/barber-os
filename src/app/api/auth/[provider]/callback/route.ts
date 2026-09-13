import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fetchSocialProfile, isSocialProvider, resolveSocialLogin } from "@/server/auth/social";
import { storePendingSocialProfile } from "@/server/auth/social-pending";
import { createDatabaseSession, sessionCookie } from "@/server/auth/session";
import { db } from "@/server/db";

async function handle(request: Request, provider: string, input: { code: string | null; state: string | null; error: string | null; appleUser: string | null }) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const fail = (reason: string) => to(`/login?erro=${reason}`);
  if (!isSocialProvider(provider)) return fail("provedor");
  if (input.error) return fail("cancelado");

  const store = await cookies();
  const expectedState = store.get(`oauth_state_${provider}`)?.value ?? null;
  const codeVerifier = store.get(`oauth_verifier_${provider}`)?.value ?? null;
  store.delete(`oauth_state_${provider}`);
  store.delete(`oauth_verifier_${provider}`);
  if (!input.code || !input.state || !expectedState || input.state !== expectedState) return fail("estado");

  let profile;
  try {
    profile = await fetchSocialProfile(provider, input.code, codeVerifier, input.appleUser);
  } catch (error) {
    console.error(`[auth/${provider}]`, error);
    return fail("provedor");
  }

  const activeMembership = { where: { isActive: true, tenant: { deletedAt: null } }, orderBy: { createdAt: "asc" as const }, take: 1, select: { tenantId: true } };
  const linked = await db.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
    select: { userId: true, user: { select: { memberships: activeMembership } } },
  });
  const byEmail = profile.email
    ? await db.user.findUnique({ where: { email: profile.email.toLowerCase() }, select: { id: true, memberships: activeMembership } })
    : null;

  const decision = resolveSocialLogin(
    profile,
    linked ? { userId: linked.userId, tenantId: linked.user.memberships[0]?.tenantId ?? null } : null,
    byEmail ? { userId: byEmail.id, tenantId: byEmail.memberships[0]?.tenantId ?? null } : null,
  );

  if (decision.kind === "complete-signup") {
    await storePendingSocialProfile(profile);
    return to(`/cadastro?via=${provider}`);
  }
  if (decision.kind === "no-tenant") return fail("sem-estabelecimento");

  if (decision.link) {
    await db.account.create({ data: { userId: decision.userId, type: "oauth", provider, providerAccountId: profile.providerAccountId } });
  }
  const session = await createDatabaseSession({ userId: decision.userId, tenantId: decision.tenantId });
  store.set(sessionCookie.name, session.sessionToken, { ...sessionCookie.options, expires: session.expires });
  return to("/painel");
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  return handle(request, provider, { code: url.searchParams.get("code"), state: url.searchParams.get("state"), error: url.searchParams.get("error"), appleUser: null });
}

// Sign in with Apple devolve por POST (response_mode=form_post).
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const form = await request.formData();
  const text = (key: string) => { const value = form.get(key); return typeof value === "string" ? value : null; };
  return handle(request, provider, { code: text("code"), state: text("state"), error: text("error"), appleUser: text("user") });
}
