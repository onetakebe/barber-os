import Link from "next/link";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Alert, AlertDescription } from "@/components/ui/alert";

const errors: Record<string, string> = {
  estado: "A sessão de login expirou. Tente de novo.",
  provedor: "Não foi possível validar o acesso. Se veio de um link por e-mail, peça um novo; se foi pelo Google, tente de novo.",
  link: "O link do e-mail expirou ou já foi usado. Peça um novo.",
  "sem-estabelecimento": "Sua conta existe, mas não está ligada a nenhuma barbearia ativa.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const message = erro ? errors[erro] : null;

  return (
    <AuthShell title="Entrar">
      {message ? <Alert variant="destructive" className="mb-4"><AlertDescription>{message}</AlertDescription></Alert> : null}
      <LoginForm />
      <div className="mt-6"><SocialButtons intent="entrar" /></div>
      <p className="mt-7 text-center text-xs text-muted-foreground">
        Ainda não tem conta? <Link href="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
