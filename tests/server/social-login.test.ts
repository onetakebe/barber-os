import { describe, expect, it } from "vitest";

import { resolveSocialLogin, type SocialProfile } from "@/server/auth/social";

const profile = (overrides: Partial<SocialProfile> = {}): SocialProfile => ({
  provider: "google",
  providerAccountId: "g-123",
  email: "dono@barbearia.com",
  emailVerified: true,
  firstName: "Ana",
  lastName: "Silva",
  imageUrl: null,
  ...overrides,
});

describe("resolveSocialLogin", () => {
  it("entra direto quando a conta social já está vinculada a um usuário com estabelecimento", () => {
    expect(resolveSocialLogin(profile(), { userId: "u1", tenantId: "t1" }, null)).toEqual({ kind: "signin", userId: "u1", tenantId: "t1", link: false });
  });

  it("vincula e entra quando o e-mail verificado já tem conta", () => {
    expect(resolveSocialLogin(profile(), null, { userId: "u2", tenantId: "t2" })).toEqual({ kind: "signin", userId: "u2", tenantId: "t2", link: true });
  });

  it("nunca vincula por e-mail não verificado — pede cadastro", () => {
    const decision = resolveSocialLogin(profile({ emailVerified: false }), null, { userId: "u2", tenantId: "t2" });
    expect(decision.kind).toBe("complete-signup");
  });

  it("pede cadastro quando ninguém conhece o e-mail", () => {
    const decision = resolveSocialLogin(profile(), null, null);
    expect(decision).toEqual({ kind: "complete-signup", profile: profile() });
  });

  it("pede cadastro quando o provedor não devolveu e-mail, mesmo com conta parecida", () => {
    expect(resolveSocialLogin(profile({ email: null }), null, { userId: "u2", tenantId: "t2" }).kind).toBe("complete-signup");
  });

  it("bloqueia usuário vinculado sem estabelecimento ativo", () => {
    expect(resolveSocialLogin(profile(), { userId: "u1", tenantId: null }, null)).toEqual({ kind: "no-tenant", userId: "u1" });
  });
});
