/* Login social (Google, Facebook, Apple) — 13/09/2026.
   As credenciais vêm só de variáveis de ambiente (ver .env.example); um
   provedor sem credencial simplesmente não está disponível. A decisão de
   "quem é esse usuário" fica em resolveSocialLogin, pura e testável. */

import { Apple, Facebook, Google, decodeIdToken } from "arctic";

export const socialProviders = ["google", "facebook", "apple"] as const;
export type SocialProvider = (typeof socialProviders)[number];

export const socialProviderLabels: Record<SocialProvider, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple",
};

export function isSocialProvider(value: string): value is SocialProvider {
  return (socialProviders as readonly string[]).includes(value);
}

export type SocialProfile = {
  provider: SocialProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function socialCallbackUrl(provider: SocialProvider) {
  return `${appUrl()}/api/auth/${provider}/callback`;
}

export function isSocialProviderConfigured(provider: SocialProvider) {
  const env = process.env;
  if (provider === "google") return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  if (provider === "facebook") return Boolean(env.AUTH_FACEBOOK_ID && env.AUTH_FACEBOOK_SECRET);
  return Boolean(env.AUTH_APPLE_ID && env.AUTH_APPLE_TEAM_ID && env.AUTH_APPLE_KEY_ID && env.AUTH_APPLE_PRIVATE_KEY);
}

export function configuredSocialProviders(): SocialProvider[] {
  return socialProviders.filter(isSocialProviderConfigured);
}

function applePrivateKey() {
  // A chave .p8 da Apple vem em PEM; a variável pode trazer as quebras de linha como "\n".
  const pem = (process.env.AUTH_APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function createSocialClient(provider: SocialProvider) {
  const env = process.env;
  const redirect = socialCallbackUrl(provider);
  if (provider === "google") return new Google(env.AUTH_GOOGLE_ID!, env.AUTH_GOOGLE_SECRET!, redirect);
  if (provider === "facebook") return new Facebook(env.AUTH_FACEBOOK_ID!, env.AUTH_FACEBOOK_SECRET!, redirect);
  return new Apple(env.AUTH_APPLE_ID!, env.AUTH_APPLE_TEAM_ID!, env.AUTH_APPLE_KEY_ID!, applePrivateKey(), redirect);
}

export type SocialAuthorization = { url: URL; state: string; codeVerifier: string | null };

export function createSocialAuthorization(provider: SocialProvider, state: string, codeVerifier: string): SocialAuthorization {
  const client = createSocialClient(provider);
  if (client instanceof Google) return { url: client.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]), state, codeVerifier };
  if (client instanceof Facebook) return { url: client.createAuthorizationURL(state, ["email", "public_profile"]), state, codeVerifier: null };
  const url = client.createAuthorizationURL(state, ["name", "email"]);
  // A Apple só devolve por POST (form_post) quando pede escopos; o callback aceita os dois.
  url.searchParams.set("response_mode", "form_post");
  return { url, state, codeVerifier: null };
}

function splitName(full: string | undefined | null): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

type IdTokenClaims = { sub?: string; email?: string; email_verified?: boolean | string; name?: string; given_name?: string; family_name?: string; picture?: string };

/** Troca o `code` pelo perfil normalizado. `appleUser` é o JSON `user` que a Apple manda só no primeiro consentimento. */
export async function fetchSocialProfile(provider: SocialProvider, code: string, codeVerifier: string | null, appleUser?: string | null): Promise<SocialProfile> {
  const client = createSocialClient(provider);

  if (client instanceof Google) {
    const tokens = await client.validateAuthorizationCode(code, codeVerifier ?? "");
    const claims = decodeIdToken(tokens.idToken()) as IdTokenClaims;
    return {
      provider,
      providerAccountId: String(claims.sub),
      email: claims.email ?? null,
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      firstName: claims.given_name ?? splitName(claims.name).firstName,
      lastName: claims.family_name ?? splitName(claims.name).lastName,
      imageUrl: claims.picture ?? null,
    };
  }

  if (client instanceof Facebook) {
    const tokens = await client.validateAuthorizationCode(code);
    const params = new URLSearchParams({ fields: "id,email,first_name,last_name,name,picture.type(large)", access_token: tokens.accessToken() });
    const response = await fetch(`https://graph.facebook.com/me?${params}`);
    if (!response.ok) throw new Error("Facebook não devolveu o perfil.");
    const me = (await response.json()) as { id: string; email?: string; first_name?: string; last_name?: string; name?: string; picture?: { data?: { url?: string } } };
    return {
      provider,
      providerAccountId: me.id,
      email: me.email ?? null,
      // O Graph API só devolve e-mail que o Facebook já verificou.
      emailVerified: Boolean(me.email),
      firstName: me.first_name ?? splitName(me.name).firstName,
      lastName: me.last_name ?? splitName(me.name).lastName,
      imageUrl: me.picture?.data?.url ?? null,
    };
  }

  const tokens = await client.validateAuthorizationCode(code);
  const claims = decodeIdToken(tokens.idToken()) as IdTokenClaims;
  let firstName = "";
  let lastName = "";
  if (appleUser) {
    try {
      const parsed = JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } };
      firstName = parsed.name?.firstName ?? "";
      lastName = parsed.name?.lastName ?? "";
    } catch {
      // Sem nome: o cadastro pede.
    }
  }
  return {
    provider,
    providerAccountId: String(claims.sub),
    email: claims.email ?? null,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    firstName,
    lastName,
    imageUrl: null,
  };
}

/* ---------- decisão pura ---------- */

export type KnownAccount = { userId: string; tenantId: string | null };
export type KnownUserByEmail = { userId: string; tenantId: string | null };

export type SocialLoginDecision =
  | { kind: "signin"; userId: string; tenantId: string; link: boolean }
  | { kind: "complete-signup"; profile: SocialProfile }
  | { kind: "no-tenant"; userId: string };

/**
 * 1. Conta social já vinculada → entra (se o usuário tiver um estabelecimento ativo).
 * 2. E-mail já cadastrado E verificado pelo provedor → vincula e entra.
 * 3. Caso contrário → completar cadastro (nome da barbearia etc.).
 * E-mail não verificado nunca vincula a uma conta existente — seria takeover por e-mail.
 */
export function resolveSocialLogin(profile: SocialProfile, linked: KnownAccount | null, byEmail: KnownUserByEmail | null): SocialLoginDecision {
  if (linked) {
    return linked.tenantId ? { kind: "signin", userId: linked.userId, tenantId: linked.tenantId, link: false } : { kind: "no-tenant", userId: linked.userId };
  }
  if (byEmail && profile.email && profile.emailVerified) {
    return byEmail.tenantId ? { kind: "signin", userId: byEmail.userId, tenantId: byEmail.tenantId, link: true } : { kind: "no-tenant", userId: byEmail.userId };
  }
  return { kind: "complete-signup", profile };
}
