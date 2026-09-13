import Link from "next/link";

import { SignupForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialButtons } from "@/components/auth/social-buttons";
import { getAuthUser, getSession } from "@/server/auth/session";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ via?: string }> }) {
  const { via } = await searchParams;
  // Entrou com Google mas ainda não tem barbearia: só falta o resto do cadastro.
  const authUser = via === "google" ? await getAuthUser() : null;
  const social = authUser?.email && !(await getSession())
    ? {
        provider: "google",
        email: authUser.email,
        firstName: (authUser.user_metadata?.given_name as string | undefined) ?? String(authUser.user_metadata?.full_name ?? "").split(" ")[0] ?? "",
        lastName: (authUser.user_metadata?.family_name as string | undefined) ?? String(authUser.user_metadata?.full_name ?? "").split(" ").slice(1).join(" "),
      }
    : null;

  return (
    <AuthShell title="Criar conta" back={{ href: "/login", label: "Voltar para entrar" }}>
      {social ? <p className="mb-5 text-sm text-muted-foreground">Conectado com Google. Falta só o nome da sua barbearia.</p> : null}
      <SignupForm social={social} />
      {social ? null : <div className="mt-6"><SocialButtons intent="criar" /></div>}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Já tem conta? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
