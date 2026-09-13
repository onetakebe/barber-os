import type { Role } from "@/domain/auth/permissions";

/* Quem é a pessoa logada, a partir do perfil do app + vínculos (Membership).
   Puro: sem Supabase, sem banco — testável. */

export type MembershipRow = {
  tenantId: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  tenant: { name: string; slug: string; deletedAt: Date | null };
};

export type ProfileWithMemberships = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  memberships: MembershipRow[];
};

export type AuthenticatedIdentity = {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  tenantName: string;
  tenantSlug: string;
};

/** Abre na barbearia ativa mais antiga da pessoa (decisão da etapa 2: sem seletor). */
export function identityFromMemberships(profile: ProfileWithMemberships | null): AuthenticatedIdentity | null {
  if (!profile) return null;
  const membership = [...profile.memberships]
    .filter((item) => item.isActive && item.tenant.deletedAt === null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  if (!membership) return null;
  return {
    userId: profile.id,
    tenantId: membership.tenantId,
    email: profile.email,
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    role: membership.role,
    tenantName: membership.tenant.name,
    tenantSlug: membership.tenant.slug,
  };
}

export type SupabaseAuthError = { code?: string; message: string };

export function mapSignInError(error: SupabaseAuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou senha inválidos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde um minuto e tente de novo.";
    default:
      return "Não foi possível entrar agora. Tente de novo.";
  }
}

/** `next` do callback: só caminho interno (nada de `//host`, `/\\host` ou esquema). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** Ligar um auth.user a um perfil já existente só é seguro com e-mail verificado pelo provedor. */
export function canLinkByEmail(authUser: { email_confirmed_at?: string | null }): boolean {
  return Boolean(authUser.email_confirmed_at);
}
