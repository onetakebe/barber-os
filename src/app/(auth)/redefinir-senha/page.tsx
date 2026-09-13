import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAuthUser } from "@/server/auth/session";

export default async function ResetPasswordPage() {
  // Só chega aqui com a sessão criada pelo link do e-mail; sem ela, pedir link de novo.
  const authUser = await getAuthUser();
  if (!authUser) redirect("/recuperar-senha?erro=link");
  return (
    <AuthShell title="Nova senha" back={{ href: "/login", label: "Voltar para entrar" }}>
      <p className="mb-5 text-sm text-muted-foreground">Defina a senha nova para {authUser.email}.</p>
      <UpdatePasswordForm />
    </AuthShell>
  );
}
