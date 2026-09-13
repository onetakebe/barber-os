import { describe, expect, it } from "vitest";

import { canInviteRole, invitationStatus, invitableRoles, INVITATION_TTL_DAYS, nameFromInvitee } from "@/domain/team/invitations";

describe("canInviteRole", () => {
  it("dono e admin convidam qualquer perfil, menos dono e cliente", () => {
    for (const inviter of ["OWNER", "ADMIN"] as const) {
      expect(canInviteRole(inviter, "ADMIN")).toBe(true);
      expect(canInviteRole(inviter, "MANAGER")).toBe(true);
      expect(canInviteRole(inviter, "RECEPTIONIST")).toBe(true);
      expect(canInviteRole(inviter, "PROFESSIONAL")).toBe(true);
      expect(canInviteRole(inviter, "OWNER")).toBe(false);
      expect(canInviteRole(inviter, "CUSTOMER")).toBe(false);
    }
  });
  it("gerente, recepção e profissional não convidam", () => {
    for (const inviter of ["MANAGER", "RECEPTIONIST", "PROFESSIONAL", "CUSTOMER"] as const) {
      expect(canInviteRole(inviter, "PROFESSIONAL")).toBe(false);
    }
  });
  it("lista os perfis convidáveis na ordem da tela", () => {
    expect(invitableRoles.map((item) => item.value)).toEqual(["ADMIN", "MANAGER", "RECEPTIONIST", "PROFESSIONAL"]);
  });
});

describe("invitationStatus", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  it("pendente enquanto não aceito e dentro do prazo", () => {
    expect(invitationStatus({ acceptedAt: null, expiresAt: new Date("2026-09-20T12:00:00Z") }, now)).toBe("pending");
  });
  it("expirado depois do prazo de 7 dias", () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(invitationStatus({ acceptedAt: null, expiresAt: new Date("2026-09-13T11:59:59Z") }, now)).toBe("expired");
  });
  it("aceito prevalece sobre expirado", () => {
    expect(invitationStatus({ acceptedAt: new Date("2026-09-10T00:00:00Z"), expiresAt: new Date("2026-09-11T00:00:00Z") }, now)).toBe("accepted");
  });
});

describe("nameFromInvitee", () => {
  it("usa o nome do provedor quando existe", () => {
    expect(nameFromInvitee("ana@x.com", { given_name: "Ana", family_name: "Silva" })).toEqual({ firstName: "Ana", lastName: "Silva" });
    expect(nameFromInvitee("ana@x.com", { full_name: "Ana Maria Silva" })).toEqual({ firstName: "Ana", lastName: "Maria Silva" });
  });
  it("cai para o começo do e-mail quando não há nome", () => {
    expect(nameFromInvitee("joao.pedro@x.com", {})).toEqual({ firstName: "joao.pedro", lastName: "" });
  });
});
