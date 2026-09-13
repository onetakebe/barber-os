import Link from "next/link";

import { RecoverForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <AuthShell title="Recuperar acesso" back={{ href: "/login", label: "Voltar para entrar" }}>
      {erro === "link" ? <p className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">O link expirou ou já foi usado. Peça um novo.</p> : null}
      <p className="mb-5 text-sm text-muted-foreground">Enviaremos um link para redefinir a senha no e-mail da sua conta.</p>
      <RecoverForm />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Lembrou a senha? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
