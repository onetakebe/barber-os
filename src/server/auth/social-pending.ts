import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import type { SocialProfile } from "@/server/auth/social";

/* Perfil social aguardando o resto do cadastro (nome da barbearia). Vai num
   cookie assinado de 15 minutos — nunca confiar em perfil vindo do cliente. */

const COOKIE = "barber_social_pending";
const TTL_SECONDS = 15 * 60;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET não definido — necessário para o login social.");
  return new TextEncoder().encode(value);
}

export async function storePendingSocialProfile(profile: SocialProfile) {
  const token = await new SignJWT({ profile }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${TTL_SECONDS}s`).sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_SECONDS });
}

export async function readPendingSocialProfile(): Promise<SocialProfile | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.profile as SocialProfile) ?? null;
  } catch {
    return null;
  }
}

export async function clearPendingSocialProfile() {
  const store = await cookies();
  store.delete(COOKIE);
}
