import type { Role } from "@/domain/auth/permissions";

/* Convite de equipe — regras puras, sem banco (testáveis). */

export const INVITATION_TTL_DAYS = 7;

export const invitableRoles: { value: Exclude<Role, "OWNER" | "CUSTOMER">; label: string; hint: string }[] = [
  { value: "ADMIN", label: "Admin", hint: "Tudo, inclusive convidar e configurar" },
  { value: "MANAGER", label: "Gerente", hint: "Operação e financeiro, sem convidar" },
  { value: "RECEPTIONIST", label: "Recepção", hint: "Agenda, clientes e fila" },
  { value: "PROFESSIONAL", label: "Profissional", hint: "Só a própria agenda e desempenho" },
];

/** Decisão da etapa 2: dono e admin convidam qualquer perfil, nunca dono; gerente não convida. */
export function canInviteRole(inviter: Role, target: Role): boolean {
  if (inviter !== "OWNER" && inviter !== "ADMIN") return false;
  return invitableRoles.some((item) => item.value === target);
}

export type InvitationStatus = "pending" | "expired" | "accepted";

export function invitationStatus(invitation: { acceptedAt: Date | null; expiresAt: Date }, now = new Date()): InvitationStatus {
  if (invitation.acceptedAt) return "accepted";
  return invitation.expiresAt > now ? "pending" : "expired";
}

export function invitationExpiry(from = new Date()) {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Nome do convidado: do provedor (Google/metadata) ou, sem nada, o começo do e-mail — ele ajusta em Perfil. */
export function nameFromInvitee(email: string, metadata: Record<string, unknown>): { firstName: string; lastName: string } {
  const given = typeof metadata.given_name === "string" ? metadata.given_name : typeof metadata.first_name === "string" ? metadata.first_name : "";
  const family = typeof metadata.family_name === "string" ? metadata.family_name : typeof metadata.last_name === "string" ? metadata.last_name : "";
  if (given) return { firstName: given, lastName: family };
  const full = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : "";
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length) return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  return { firstName: email.split("@")[0], lastName: "" };
}
