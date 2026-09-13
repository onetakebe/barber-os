import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSocialAuthorization, isSocialProvider, isSocialProviderConfigured } from "@/server/auth/social";

const TEN_MINUTES = 10 * 60;

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  // Redirecionamentos internos seguem a origem do pedido; NEXT_PUBLIC_APP_URL só
  // entra no callback registrado no provedor, que precisa bater com o console.
  if (!isSocialProvider(provider)) return NextResponse.redirect(new URL("/login?erro=provedor", request.url));
  if (!isSocialProviderConfigured(provider)) return NextResponse.redirect(new URL(`/login?erro=nao-configurado&provedor=${provider}`, request.url));

  const authorization = createSocialAuthorization(provider, generateState(), generateCodeVerifier());
  const store = await cookies();
  // A Apple responde por POST cross-site: o cookie precisa ser SameSite=None para chegar.
  const sameSite = provider === "apple" ? ("none" as const) : ("lax" as const);
  const options = { httpOnly: true, sameSite, secure: process.env.NODE_ENV === "production" || sameSite === "none", path: "/", maxAge: TEN_MINUTES };
  store.set(`oauth_state_${provider}`, authorization.state, options);
  if (authorization.codeVerifier) store.set(`oauth_verifier_${provider}`, authorization.codeVerifier, options);
  return NextResponse.redirect(authorization.url);
}
