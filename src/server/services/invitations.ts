/* Convite de equipe — parte com banco e Supabase (só servidor). Regras puras em @/domain/team/invitations. */
import type { User as SupabaseUser } from "@supabase/supabase-js";

import type { Role } from "@/domain/auth/permissions";
import { canInviteRole, invitationExpiry, invitationStatus, nameFromInvitee } from "@/domain/team/invitations";
import { db } from "@/server/db";
import { createSupabaseAdminClient } from "@/server/supabase/server";


function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type CreateInvitationInput = { tenantId: string; email: string; role: Role; staffId?: string | null; invitedById: string; inviterRole: Role };
export type CreateInvitationResult = { kind: "emailed" } | { kind: "added" } | { kind: "error"; message: string };

/**
 * Cria/renova o convite e dispara o e-mail pelo Supabase. Se a pessoa já tem conta
 * (no app ou só no Supabase), o vínculo é criado na hora — sem e-mail, pois o Supabase
 * não convida quem já existe; ela vê a barbearia no próximo login.
 */
export async function createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const email = input.email.trim().toLowerCase();
  if (!canInviteRole(input.inviterRole, input.role)) return { kind: "error", message: "Você não pode convidar com esse perfil." };

  const alreadyMember = await db.membership.findFirst({ where: { tenantId: input.tenantId, user: { email } }, select: { id: true, isActive: true } });
  if (alreadyMember?.isActive) return { kind: "error", message: "Essa pessoa já faz parte da equipe." };

  const invitation = await db.invitation.upsert({
    where: { tenantId_email: { tenantId: input.tenantId, email } },
    update: { role: input.role, staffId: input.staffId ?? null, invitedById: input.invitedById, expiresAt: invitationExpiry(), acceptedAt: null },
    create: { tenantId: input.tenantId, email, role: input.role, staffId: input.staffId ?? null, invitedById: input.invitedById, expiresAt: invitationExpiry() },
  });

  // Já tem perfil no app (e-mail confirmado no Supabase) → entra direto.
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, authUserId: true } });
  if (existing?.authUserId) {
    await acceptInvitationForUser(invitation.id, existing.id);
    return { kind: "added" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { invited_tenant_id: input.tenantId, invited_role: input.role },
    redirectTo: `${appUrl()}/redefinir-senha`,
  });
  if (!error) return { kind: "emailed" };
  if (error.code === "email_exists") {
    // Conta no Supabase sem perfil no app: aceita no próximo login (acceptPendingInvitations).
    return { kind: "added" };
  }
  if (error.code === "over_email_send_rate_limit") return { kind: "error", message: "Muitos convites em pouco tempo. Aguarde um minuto." };
  return { kind: "error", message: "Não foi possível enviar o convite agora." };
}

async function acceptInvitationForUser(invitationId: string, userId: string) {
  const invitation = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) return;
  await db.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { tenantId_userId: { tenantId: invitation.tenantId, userId } },
      update: { role: invitation.role, isActive: true },
      create: { tenantId: invitation.tenantId, userId, role: invitation.role },
    });
    if (invitation.staffId) await tx.staff.updateMany({ where: { id: invitation.staffId, tenantId: invitation.tenantId, userId: null }, data: { userId } });
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  });
}

/**
 * Chamado quando alguém logado (e-mail confirmado) não tem vínculo: aceita os convites
 * pendentes do e-mail, criando o perfil no app se for a primeira vez. Devolve true se aceitou algum.
 */
export async function acceptPendingInvitations(authUser: SupabaseUser): Promise<boolean> {
  if (!authUser.email || !authUser.email_confirmed_at) return false;
  const email = authUser.email.toLowerCase();
  const pending = await db.invitation.findMany({ where: { email, acceptedAt: null, expiresAt: { gt: new Date() } } });
  if (!pending.length) return false;

  const name = nameFromInvitee(email, (authUser.user_metadata ?? {}) as Record<string, unknown>);
  const user = await db.user.upsert({
    where: { email },
    update: { authUserId: authUser.id },
    create: { email, authUserId: authUser.id, firstName: name.firstName, lastName: name.lastName, emailVerified: new Date() },
    select: { id: true },
  });
  for (const invitation of pending) await acceptInvitationForUser(invitation.id, user.id);
  return true;
}

export async function resendInvitation(tenantId: string, invitationId: string): Promise<CreateInvitationResult> {
  const invitation = await db.invitation.findFirst({ where: { id: invitationId, tenantId, acceptedAt: null } });
  if (!invitation) return { kind: "error", message: "Convite não encontrado." };
  await db.invitation.update({ where: { id: invitation.id }, data: { expiresAt: invitationExpiry() } });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(invitation.email, {
    data: { invited_tenant_id: tenantId, invited_role: invitation.role },
    redirectTo: `${appUrl()}/redefinir-senha`,
  });
  if (!error) return { kind: "emailed" };
  if (error.code === "email_exists") return { kind: "added" };
  if (error.code === "over_email_send_rate_limit") return { kind: "error", message: "Muitos convites em pouco tempo. Aguarde um minuto." };
  return { kind: "error", message: "Não foi possível reenviar agora." };
}

export async function cancelInvitation(tenantId: string, invitationId: string) {
  await db.invitation.deleteMany({ where: { id: invitationId, tenantId, acceptedAt: null } });
}

export async function listTeamAccess(tenantId: string) {
  const [members, invitations] = await Promise.all([
    db.membership.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, isActive: true, user: { select: { firstName: true, lastName: true, email: true, imageUrl: true } } } }),
    db.invitation.findMany({ where: { tenantId, acceptedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, staff: { select: { displayName: true } } } }),
  ]);
  const now = new Date();
  return {
    members: members.map((item) => ({ id: item.id, name: `${item.user.firstName} ${item.user.lastName}`.trim(), email: item.user.email, role: item.role, isActive: item.isActive, imageUrl: item.user.imageUrl })),
    invitations: invitations.map((item) => ({ id: item.id, email: item.email, role: item.role, expiresAt: item.expiresAt, staffName: item.staff?.displayName ?? null, status: invitationStatus(item, now) })),
  };
}
