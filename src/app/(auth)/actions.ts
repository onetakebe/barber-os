"use server";

import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticateCandidate } from "@/server/auth/service";
import { createDatabaseSession, sessionCookie } from "@/server/auth/session";
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
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error) };

  const existing = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return { status: "error", message: "Já existe uma conta com este e-mail." };

  const passwordHash = await hash(parsed.data.password, 12);
  const slugBase = slugify(parsed.data.businessName);
  const slugExists = await db.tenant.findUnique({ where: { slug: slugBase }, select: { id: true } });
  const slug = slugExists ? `${slugBase}-${crypto.randomUUID().slice(0, 6)}` : slugBase;

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        passwordHash,
      },
    });
    const tenant = await tx.tenant.create({
      data: {
        name: parsed.data.businessName,
        slug,
        email: parsed.data.email,
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
