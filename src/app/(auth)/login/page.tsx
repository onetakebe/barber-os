import Link from "next/link";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isSocialProvider, socialProviderLabels } from "@/server/auth/social";

const socialErrors: Record<string, string> = {
  cancelado: "Você cancelou o acesso no provedor.",
  estado: "A sessão de login expirou. Tente de novo.",
  provedor: "Não foi possível concluir o login com o provedor.",
  "sem-estabelecimento": "Sua conta existe, mas não está ligada a nenhuma barbearia ativa.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; provedor?: string }> }) {
  const { erro, provedor } = await searchParams;
  const message =
    erro === "nao-configurado" && provedor && isSocialProvider(provedor)
      ? `Entrar com ${socialProviderLabels[provedor]} ainda não está configurado neste ambiente.`
      : erro
        ? socialErrors[erro]
        : null;

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
