import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/server/auth/identity";
import { getSession } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";

/* Links de e-mail (confirmação, redefinição de senha, convite) com token_hash:
   verificados aqui no servidor, sem depender de cookie PKCE — funcionam em
   outro navegador/celular e não morrem se o provedor de e-mail pré-visitar o link.
   Os modelos de e-mail no painel do Supabase apontam para esta rota. */
const allowedTypes: EmailOtpType[] = ["signup", "recovery", "invite", "email", "email_change", "magiclink"];
const fallbackByType: Partial<Record<EmailOtpType, string>> = { recovery: "/redefinir-senha", invite: "/redefinir-senha", signup: "/configuracoes", email: "/configuracoes" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!tokenHash || !type || !allowedTypes.includes(type)) return to("/login?erro=estado");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return to(type === "recovery" ? "/recuperar-senha?erro=link" : "/login?erro=link");

  const next = safeNextPath(url.searchParams.get("next")) ?? fallbackByType[type];
  if (next) return to(next);
  const session = await getSession();
  return to(session ? "/painel" : "/cadastro?completar=1");
}
