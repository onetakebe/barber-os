import Link from "next/link";

import { ResendConfirmationForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAuthUser } from "@/server/auth/session";

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const authUser = await getAuthUser();
  const known = authUser?.email ?? email ?? "";
  return (
    <AuthShell title="Confirme seu e-mail" back={{ href: "/login", label: "Voltar para entrar" }}>
      <p className="mb-5 text-sm leading-6 text-muted-foreground">
        Enviamos um link de confirmação{known ? <> para <span className="font-medium text-foreground">{known}</span></> : null}. Clique nele para entrar no painel. Não chegou? Veja o spam ou peça outro abaixo.
      </p>
      <ResendConfirmationForm email={known} />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        E-mail errado? <Link href="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">Criar conta de novo</Link>
      </p>
    </AuthShell>
  );
}
