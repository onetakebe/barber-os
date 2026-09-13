import Link from "next/link";

import { RecoverForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RecoverPage() {
  return (
    <AuthShell title="Recuperar acesso" back={{ href: "/login", label: "Voltar para entrar" }}>
      <p className="mb-5 text-sm text-muted-foreground">Enviaremos um link para redefinir a senha no e-mail da sua conta.</p>
      <RecoverForm />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Lembrou a senha? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
