"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invitableRoles } from "@/domain/team/invitations";
import { AuthorizationError, authorizeAction } from "@/server/auth/authorization";
import { cancelInvitation, createInvitation, resendInvitation } from "@/server/services/invitations";

export type InviteActionState = { status: "idle" | "error" | "success"; message?: string; errors?: Record<string, string[]> };

const inviteSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  role: z.enum(invitableRoles.map((item) => item.value) as [string, ...string[]], { error: "Escolha um perfil." }),
  staffId: z.string().optional(),
});

function fieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export async function inviteTeamMemberAction(_state: InviteActionState, formData: FormData): Promise<InviteActionState> {
  try {
    const session = await authorizeAction("team:invite");
    const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };
    const result = await createInvitation({
      tenantId: session.tenantId,
      email: parsed.data.email,
      role: parsed.data.role as (typeof invitableRoles)[number]["value"],
      staffId: parsed.data.staffId || null,
      invitedById: session.userId,
      inviterRole: session.role,
    });
    if (result.kind === "error") return { status: "error", message: result.message };
    revalidatePath("/equipe");
    return { status: "success", message: result.kind === "emailed" ? `Convite enviado para ${parsed.data.email}.` : `${parsed.data.email} já tinha conta: acesso liberado no próximo login.` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Você não tem permissão para convidar." };
    throw error;
  }
}

export async function resendInvitationAction(_state: InviteActionState, formData: FormData): Promise<InviteActionState> {
  try {
    const session = await authorizeAction("team:invite");
    const id = String(formData.get("invitationId") ?? "");
    const result = await resendInvitation(session.tenantId, id);
    revalidatePath("/equipe");
    return result.kind === "error" ? { status: "error", message: result.message } : { status: "success", message: "Convite reenviado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Você não tem permissão para convidar." };
    throw error;
  }
}

export async function cancelInvitationAction(_state: InviteActionState, formData: FormData): Promise<InviteActionState> {
  try {
    const session = await authorizeAction("team:invite");
    await cancelInvitation(session.tenantId, String(formData.get("invitationId") ?? ""));
    revalidatePath("/equipe");
    return { status: "success", message: "Convite cancelado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Você não tem permissão para convidar." };
    throw error;
  }
}
