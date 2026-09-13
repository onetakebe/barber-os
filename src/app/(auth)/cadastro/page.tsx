import Link from "next/link";

import { SignupForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialButtons } from "@/components/auth/social-buttons";
import { isSocialProvider, socialProviderLabels } from "@/server/auth/social";
import { readPendingSocialProfile } from "@/server/auth/social-pending";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ via?: string }> }) {
  const { via } = await searchParams;
  const social = via && isSocialProvider(via) ? await readPendingSocialProfile() : null;

  return (
    <AuthShell title="Criar conta" back={{ href: "/login", label: "Voltar para entrar" }}>
      {social ? (
        <p className="mb-5 text-sm text-muted-foreground">
          Conectado com {socialProviderLabels[social.provider]}. Falta só o nome da sua barbearia.
        </p>
      ) : null}
      <SignupForm social={social ? { provider: social.provider, email: social.email ?? "", firstName: social.firstName, lastName: social.lastName } : null} />
      {social ? null : <div className="mt-6"><SocialButtons intent="criar" /></div>}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Já tem conta? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
