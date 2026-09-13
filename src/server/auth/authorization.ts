import { redirect } from "next/navigation";

import { authorize, type Permission } from "@/domain/auth/permissions";
import { getAuthUser, getSession, type AppSession } from "@/server/auth/session";

export class AuthorizationError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    // Logado no Supabase mas sem barbearia ou sem e-mail confirmado → tela certa, não /login em loop.
    const authUser = await getAuthUser();
    if (authUser && !authUser.email_confirmed_at) redirect("/confirmar-email");
    if (authUser) redirect("/cadastro?completar=1");
    redirect("/login");
  }
  return session;
}

export async function requirePermission(permission: Permission): Promise<AppSession> {
  const session = await requireSession();
  if (!authorize(session.role, permission)) redirect("/acesso-negado");
  return session;
}

export async function authorizeAction(permission: Permission): Promise<AppSession> {
  const session = await getSession();
  if (!session) throw new AuthorizationError("UNAUTHENTICATED");
  if (!authorize(session.role, permission)) throw new AuthorizationError("FORBIDDEN");
  return session;
}
