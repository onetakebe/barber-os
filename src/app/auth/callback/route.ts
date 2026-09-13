import { NextResponse } from "next/server";

import { safeNextPath } from "@/server/auth/identity";
import { getSession } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";

/* Volta do Supabase (Google, confirmação de e-mail, redefinição de senha):
   troca o `code` por sessão nos cookies e decide para onde ir. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!code) return to("/login?erro=estado");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return to("/login?erro=provedor");

  const safeNext = safeNextPath(next);
  if (safeNext) return to(safeNext);
  const session = await getSession();
  return to(session ? "/painel" : "/cadastro?completar=1");
}
