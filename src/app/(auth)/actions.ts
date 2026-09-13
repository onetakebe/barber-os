"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { mapSignInError } from "@/server/auth/identity";
import { getAuthUser, getSession } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { adminDb as db, adminTransaction } from "@/server/db";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

const signupSchema = z.object({
  firstName: z.string().trim().min(2, "Informe seu nome."),
  lastName: z.string().trim().min(2, "Informe seu sobrenome."),
  businessName: z.string().trim().min(2, "Informe o nome da barbearia."),
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Use pelo menos 8 caracteres.")
    .regex(/[A-Za-z]/, "Inclua uma letra.")
    .regex(/[0-9]/, "Inclua um número."),
  confirmPassword: z.string(),
  terms: z.literal("on", { error: "Aceite os termos para continuar." }),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "As senhas não coincidem." });

// Cadastro de quem entrou com Google e ainda não tem barbearia: e-mail e identidade
// vêm do Supabase, só falta o resto.
const socialSignupSchema = z.object({
  firstName: z.string().trim().min(2, "Informe seu nome."),
  lastName: z.string().trim().min(2, "Informe seu sobrenome."),
  businessName: z.string().trim().min(2, "Informe o nome da barbearia."),
  terms: z.literal("on", { error: "Aceite os termos para continuar." }),
});

const recoverSchema = z.object({ email: z.email("Informe um e-mail válido.").trim().toLowerCase() });

function fieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "barbearia";
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: mapSignInError(error) };
  // Conta existe no Supabase mas sem barbearia no app (cadastro interrompido): completar, não dar loop.
  const session = await getSession();
  redirect(session ? "/painel" : "/cadastro?completar=1");
}

export async function signInWithGoogleAction() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${appUrl()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?erro=provedor");
  redirect(data.url);
}

/** Cria perfil + barbearia + vínculo de dono para um usuário já existente em auth.users. */
async function createOwnerWorkspace(input: { authUserId: string; email: string; firstName: string; lastName: string; businessName: string; imageUrl?: string | null; emailVerified: boolean }) {
  const slugBase = slugify(input.businessName);
  const slugExists = await db.tenant.findUnique({ where: { slug: slugBase }, select: { id: true } });
  const slug = slugExists ? `${slugBase}-${crypto.randomUUID().slice(0, 6)}` : slugBase;

  return adminTransaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: input.email },
      update: { authUserId: input.authUserId, firstName: input.firstName, lastName: input.lastName },
      create: { email: input.email, authUserId: input.authUserId, firstName: input.firstName, lastName: input.lastName, imageUrl: input.imageUrl ?? null, emailVerified: input.emailVerified ? new Date() : null },
    });
    const tenant = await tx.tenant.create({
      data: {
        name: input.businessName,
        slug,
        email: input.email,
        units: { create: { name: "Unidade principal", address: "Endereço a configurar" } },
        categories: { create: { name: "Serviços" } },
      },
    });
    await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    return { userId: user.id, tenantId: tenant.id };
  });
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (formData.get("social") === "1") {
    const authUser = await getAuthUser();
    if (!authUser?.email) return { status: "error", message: "A sessão expirou. Entre de novo para completar o cadastro." };
    const parsed = socialSignupSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };
    const existing = await db.membership.findFirst({ where: { user: { email: authUser.email.toLowerCase() }, isActive: true }, select: { id: true } });
    if (existing) redirect("/painel");
    await createOwnerWorkspace({
      authUserId: authUser.id,
      email: authUser.email.toLowerCase(),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      businessName: parsed.data.businessName,
      imageUrl: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
      emailVerified: Boolean(authUser.email_confirmed_at),
    });
    redirect("/configuracoes");
  }

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };

  const existing = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return { status: "error", message: "Já existe uma conta com este e-mail." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=/configuracoes`,
      data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
    },
  });
  if (error) return { status: "error", message: error.code === "user_already_exists" ? "Já existe uma conta com este e-mail." : "Não foi possível criar a conta agora. Tente de novo." };
  // Com confirmação de e-mail ligada, e-mail repetido volta como "sucesso" com identities vazio.
  if (!data.user || data.user.identities?.length === 0) return { status: "error", message: "Já existe uma conta com este e-mail. Use \"Esqueci a senha\" se precisar recuperar o acesso." };

  await createOwnerWorkspace({
    authUserId: data.user.id,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    businessName: parsed.data.businessName,
    emailVerified: Boolean(data.user.email_confirmed_at),
  });

  // Com confirmação de e-mail ligada, o Supabase não abre sessão até o clique no link.
  if (!data.session) {
    return { status: "success", message: "Conta criada. Enviamos um link de confirmação para o seu e-mail — clique nele para entrar." };
  }
  redirect("/configuracoes");
}

export async function recoverAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = recoverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${appUrl()}/auth/callback?next=/redefinir-senha` });
  // Resposta igual exista ou não a conta — não revelar e-mails cadastrados.
  return { status: "success", message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
}

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "Use pelo menos 8 caracteres.")
    .regex(/[A-Za-z]/, "Inclua uma letra.")
    .regex(/[0-9]/, "Inclua um número."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "As senhas não coincidem." });

/** Tela /redefinir-senha: a sessão veio do link do e-mail (callback trocou o code). */
export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", errors: { password: ["Escolha uma senha diferente da atual."] } };
    return { status: "error", message: "O link expirou ou já foi usado. Peça um novo em \"Esqueci a senha\"." };
  }
  const session = await getSession();
  redirect(session ? "/painel" : "/cadastro?completar=1");
}

export async function resendConfirmationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = recoverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: `${appUrl()}/auth/callback?next=/configuracoes` } });
  if (error?.code === "over_email_send_rate_limit") return { status: "error", message: "Já enviamos um e-mail há pouco. Aguarde um minuto antes de pedir outro." };
  return { status: "success", message: "Se a conta existir e ainda não estiver confirmada, um novo e-mail foi enviado." };
}
