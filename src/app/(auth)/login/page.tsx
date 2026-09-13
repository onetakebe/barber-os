import Link from "next/link";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="Entrar">
      <LoginForm />
      <p className="mt-7 text-center text-xs text-muted-foreground">
        Ainda não tem conta? <Link href="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
