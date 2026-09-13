import Link from "next/link";

import { SignupForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignupPage() {
  return (
    <AuthShell title="Criar conta" back={{ href: "/login", label: "Voltar para entrar" }}>
      <SignupForm />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Já tem conta? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
