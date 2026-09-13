"use server";

import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticateCandidate } from "@/server/auth/service";
import { createDatabaseSession, sessionCookie } from "@/server/auth/session";
import { clearPendingSocialProfile, readPendingSocialProfile } from "@/server/auth/social-pending";
import { db } from "@/server/db";

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

// Cadastro vindo do login social: o provedor já deu e-mail (e às vezes nome); não há senha.
const socialSignupSchema = z.object({
  firstName: z.string().trim().min(2, "Informe seu nome."),
  lastName: z.string().trim().min(2, "Informe seu sobrenome."),
  businessName: z.string().trim().min(2, "Informe o nome da barbearia."),
  terms: z.literal("on", { error: "Aceite os termos para continuar." }),
});

const recoverSchema = z.object({ email: z.email().trim().toLowerCase() });

function fieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "barbearia";
}

async function writeSessionCookie(userId: string, tenantId: string) {
  const session = await createDatabaseSession({ userId, tenantId });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, session.sessionToken, {
    ...sessionCookie.options,
    expires: session.expires,
  });
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };

  const candidate = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          tenantId: true,
          role: true,
          isActive: true,
          tenant: { select: { name: true, slug: true, deletedAt: true } },
        },
      },
    },
  });
  const identity = await authenticateCandidate(parsed.data, candidate);
  if (!identity) {
    return { status: "error", message: "E-mail ou senha inválidos." };
  }

  await writeSessionCookie(identity.userId, identity.tenantId);
  redirect("/painel");
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const social = formData.get("social") === "1" ? await readPendingSocialProfile() : null;
  if (formData.get("social") === "1" && !social) {
    return { status: "error", message: "O login social expirou. Tente entrar de novo." };
  }

  let data: { firstName: string; lastName: string; businessName: string; email: string; password: string | null };
  if (social) {
    const parsed = socialSignupSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };
    if (!social.email) return { status: "error", message: `${social.provider} não compartilhou um e-mail. Use outra forma de entrar.` };
    data = { ...parsed.data, email: social.email.toLowerCase(), password: null };
  } else {
    const parsed = signupSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };
    data = parsed.data;
  }

  const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) return { status: "error", message: "Já existe uma conta com este e-mail." };

  const passwordHash = data.password ? await hash(data.password, 12) : null;
  const slugBase = slugify(data.businessName);
  const slugExists = await db.tenant.findUnique({ where: { slug: slugBase }, select: { id: true } });
  const slug = slugExists ? `${slugBase}-${crypto.randomUUID().slice(0, 6)}` : slugBase;

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        imageUrl: social?.imageUrl ?? null,
        emailVerified: social?.emailVerified ? new Date() : null,
        accounts: social ? { create: { type: "oauth", provider: social.provider, providerAccountId: social.providerAccountId } } : undefined,
      },
    });
    const tenant = await tx.tenant.create({
      data: {
        name: data.businessName,
        slug,
        email: data.email,
        units: {
          create: {
            name: "Unidade principal",
            address: "Endereço a configurar",
          },
        },
        categories: { create: { name: "Serviços" } },
      },
    });
    await tx.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
    });
    return { userId: user.id, tenantId: tenant.id };
  });

  if (social) await clearPendingSocialProfile();
  await writeSessionCookie(created.userId, created.tenantId);
  redirect("/configuracoes");
}

export async function recoverAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = recoverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };

  return {
    status: "success",
    message: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.",
  };
}
