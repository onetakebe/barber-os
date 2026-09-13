import { describe, expect, it } from "vitest";

import { identityFromMemberships, mapSignInError, type ProfileWithMemberships } from "@/server/auth/identity";

const profile = (overrides: Partial<ProfileWithMemberships> = {}): ProfileWithMemberships => ({
  id: "u1",
  email: "dono@barbearia.com",
  firstName: "Ana",
  lastName: "Silva",
  memberships: [
    { tenantId: "t-nova", role: "OWNER", isActive: true, createdAt: new Date("2026-09-13"), tenant: { name: "Nova", slug: "nova", deletedAt: null } },
    { tenantId: "t-as", role: "MANAGER", isActive: true, createdAt: new Date("2026-07-14"), tenant: { name: "AS Barber Club", slug: "as-barber-club", deletedAt: null } },
  ],
  ...overrides,
});

describe("identityFromMemberships", () => {
  it("abre na barbearia ativa mais antiga da pessoa", () => {
    const identity = identityFromMemberships(profile());
    expect(identity).toMatchObject({ userId: "u1", tenantId: "t-as", role: "MANAGER", tenantSlug: "as-barber-club", name: "Ana Silva" });
  });

  it("ignora vínculos inativos e barbearias apagadas", () => {
    const identity = identityFromMemberships(profile({
      memberships: [
        { tenantId: "t-x", role: "OWNER", isActive: false, createdAt: new Date("2026-01-01"), tenant: { name: "X", slug: "x", deletedAt: null } },
        { tenantId: "t-y", role: "OWNER", isActive: true, createdAt: new Date("2026-02-01"), tenant: { name: "Y", slug: "y", deletedAt: new Date() } },
        { tenantId: "t-z", role: "RECEPTIONIST", isActive: true, createdAt: new Date("2026-03-01"), tenant: { name: "Z", slug: "z", deletedAt: null } },
      ],
    }));
    expect(identity?.tenantId).toBe("t-z");
  });

  it("devolve null sem vínculo utilizável", () => {
    expect(identityFromMemberships(profile({ memberships: [] }))).toBeNull();
    expect(identityFromMemberships(null)).toBeNull();
  });
});

describe("mapSignInError", () => {
  it("traduz credencial inválida sem revelar se o e-mail existe", () => {
    expect(mapSignInError({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("E-mail ou senha inválidos.");
  });
  it("pede confirmação de e-mail quando ainda não confirmado", () => {
    expect(mapSignInError({ code: "email_not_confirmed", message: "Email not confirmed" })).toBe("Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.");
  });
  it("tem um fallback genérico", () => {
    expect(mapSignInError({ code: "over_request_rate_limit", message: "x" })).toBe("Muitas tentativas. Aguarde um minuto e tente de novo.");
    expect(mapSignInError({ message: "boom" })).toBe("Não foi possível entrar agora. Tente de novo.");
  });
});
