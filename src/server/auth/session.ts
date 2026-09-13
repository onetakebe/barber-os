import { cache } from "react";

import { canLinkByEmail, identityFromMemberships, type AuthenticatedIdentity } from "@/server/auth/identity";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { db } from "@/server/db";

export type AppSession = AuthenticatedIdentity;
export type DemoSession = AppSession;

const membershipSelect = {
  orderBy: { createdAt: "asc" as const },
  select: { tenantId: true, role: true, isActive: true, createdAt: true, tenant: { select: { name: true, slug: true, deletedAt: true } } },
};

/* Quem está logado: o Supabase diz qual `auth.users`; o app acha o perfil pelo
   `authUserId` (ou pelo e-mail na primeira vez, e grava o vínculo). */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser?.email) return null;
  // Decisão da etapa 2: sem e-mail confirmado não há painel (requireSession manda confirmar).
  if (!authUser.email_confirmed_at) return null;

  let profile = await db.user.findUnique({ where: { authUserId: authUser.id }, select: { id: true, email: true, firstName: true, lastName: true, memberships: membershipSelect } });
  if (!profile && canLinkByEmail(authUser)) {
    const byEmail = await db.user.findUnique({ where: { email: authUser.email.toLowerCase() }, select: { id: true, authUserId: true } });
    if (byEmail && !byEmail.authUserId) {
      profile = await db.user.update({ where: { id: byEmail.id }, data: { authUserId: authUser.id }, select: { id: true, email: true, firstName: true, lastName: true, memberships: membershipSelect } });
    }
  }
  return identityFromMemberships(profile);
});

/** O usuário do Supabase, mesmo sem perfil no app ainda (cadastro por Google a completar). */
export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
