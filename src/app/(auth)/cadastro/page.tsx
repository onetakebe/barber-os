import Link from "next/link";

import { SignupForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialButtons } from "@/components/auth/social-buttons";
import { getAuthUser, getSession } from "@/server/auth/session";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ completar?: string }> }) {
  const { completar } = await searchParams;
  // Já tem conta no Supabase (Google ou cadastro interrompido) mas nenhuma barbearia: só falta o resto.
  const authUser = completar === "1" ? await getAuthUser() : null;
  const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  const social = authUser?.email && !(await getSession())
    ? {
        provider: authUser.app_metadata?.provider === "google" ? "google" : "email",
        email: authUser.email,
        firstName: String(meta.given_name ?? meta.first_name ?? fullName.split(" ")[0] ?? ""),
        lastName: String(meta.family_name ?? meta.last_name ?? fullName.split(" ").slice(1).join(" ")),
      }
    : null;

  return (
    <AuthShell title="Criar conta" back={{ href: "/login", label: "Voltar para entrar" }}>
      {social ? <p className="mb-5 text-sm text-muted-foreground">{social.provider === "google" ? "Conectado com Google." : "Sua conta já existe."} Falta só o nome da sua barbearia.</p> : null}
      <SignupForm social={social} />
      {social ? null : <div className="mt-6"><SocialButtons intent="criar" /></div>}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Já tem conta? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
