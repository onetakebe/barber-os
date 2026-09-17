"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Permission } from "@/domain/auth/permissions";
import { AuthorizationError, authorizeAction } from "@/server/auth/authorization";
import { tenantDb, tenantTransaction } from "@/server/db";

export type ModuleActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

const text = (label: string) => z.string().trim().min(2, `${label} é obrigatório.`);
const positiveMoney = z.coerce.number().positive("Informe um valor maior que zero.");
// Foto do profissional: URL http(s) ou caminho servido pelo próprio app (/images/...).
const photoUrl = z.union([
  z.literal(""),
  z.string().trim().regex(/^(https?:\/\/|\/)\S+$/, "Informe uma URL http(s) ou um caminho começando com /."),
]);

const schemas = {
  clientes: z.object({ module: z.literal("clientes"), firstName: text("Nome"), lastName: text("Sobrenome"), email: z.union([z.literal(""), z.email("E-mail inválido.")]), phone: text("Telefone") }),
  equipe: z.object({ module: z.literal("equipe"), displayName: text("Nome"), title: text("Função"), commissionPercent: z.coerce.number().min(0).max(100), imageUrl: photoUrl }),
  servicos: z.object({ module: z.literal("servicos"), name: text("Nome"), description: z.string().trim(), price: positiveMoney, durationMinutes: z.coerce.number().int().min(10).max(480) }),
  produtos: z.object({ module: z.literal("produtos"), name: text("Nome"), sku: text("SKU"), category: text("Categoria"), price: positiveMoney, cost: z.coerce.number().min(0), stock: z.coerce.number().int().min(0), minimumStock: z.coerce.number().int().min(0) }),
  campanhas: z.object({ module: z.literal("campanhas"), name: text("Nome"), audienceSegment: text("Público"), message: text("Mensagem") }),
  fidelidade: z.object({ module: z.literal("fidelidade"), name: text("Nome"), pointsCost: z.coerce.number().int().positive(), benefitType: text("Benefício") }),
  financeiro: z.object({ module: z.literal("financeiro"), category: text("Categoria"), description: text("Descrição"), amount: positiveMoney, dueAt: z.iso.date("Data inválida.") }),
} as const;

type MutableModule = keyof typeof schemas;

const permissions: Record<MutableModule, Permission> = {
  clientes: "customers:edit",
  equipe: "team:edit",
  servicos: "services:edit",
  produtos: "products:edit",
  campanhas: "campaigns:create",
  fidelidade: "loyalty:edit",
  financeiro: "finance:edit",
};

function validationErrors(error: z.ZodError) {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export async function createModuleRecordAction(
  _state: ModuleActionState,
  formData: FormData,
): Promise<ModuleActionState> {
  const moduleValue = formData.get("module");
  if (typeof moduleValue !== "string" || !(moduleValue in schemas)) return { status: "error", message: "Módulo inválido." };
  const slug = moduleValue as MutableModule;
  const parsed = schemas[slug].safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: validationErrors(parsed.error) };

  try {
    const session = await authorizeAction(permissions[slug]);
    const db = tenantDb(session.tenantId);
    let entityId = "";

    if (parsed.data.module === "clientes") {
      const created = await db.customer.create({ data: { tenantId: session.tenantId, firstName: parsed.data.firstName, lastName: parsed.data.lastName, email: parsed.data.email || null, phone: parsed.data.phone } });
      entityId = created.id;
    }
    if (parsed.data.module === "equipe") {
      const services = await db.service.findMany({ where: { tenantId: session.tenantId, isActive: true, deletedAt: null }, select: { id: true } });
      const created = await db.staff.create({ data: { tenantId: session.tenantId, displayName: parsed.data.displayName, title: parsed.data.title, imageUrl: parsed.data.imageUrl || null, commissionBps: Math.round(parsed.data.commissionPercent * 100), services: { create: services.map((service) => ({ tenantId: session.tenantId, serviceId: service.id })) }, availability: { create: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ tenantId: session.tenantId, dayOfWeek, startMinute: 540, endMinute: dayOfWeek === 6 ? 1080 : 1140, breakStartMinute: 780, breakEndMinute: 840 })) } } });
      entityId = created.id;
    }
    if (parsed.data.module === "servicos") {
      const category = await db.serviceCategory.upsert({ where: { tenantId_name: { tenantId: session.tenantId, name: "Serviços" } }, update: {}, create: { tenantId: session.tenantId, name: "Serviços" } });
      const staff = await db.staff.findMany({ where: { tenantId: session.tenantId, isBookable: true, deletedAt: null }, select: { id: true } });
      const created = await db.service.create({ data: { tenantId: session.tenantId, categoryId: category.id, name: parsed.data.name, description: parsed.data.description || null, priceCents: Math.round(parsed.data.price * 100), durationMinutes: parsed.data.durationMinutes, staff: { create: staff.map((member) => ({ tenantId: session.tenantId, staffId: member.id })) } } });
      entityId = created.id;
    }
    if (parsed.data.module === "produtos") {
      const productData = parsed.data;
      const created = await tenantTransaction(session.tenantId, async (tx) => {
        const product = await tx.product.create({ data: { tenantId: session.tenantId, name: productData.name, sku: productData.sku.toUpperCase(), category: productData.category, priceCents: Math.round(productData.price * 100), costCents: Math.round(productData.cost * 100), stock: productData.stock, minimumStock: productData.minimumStock } });
        if (productData.stock > 0) await tx.inventoryMovement.create({ data: { tenantId: session.tenantId, productId: product.id, type: "PURCHASE", quantity: productData.stock, reason: "Estoque inicial" } });
        return product;
      });
      entityId = created.id;
    }
    if (parsed.data.module === "campanhas") {
      const created = await db.campaign.create({ data: { tenantId: session.tenantId, name: parsed.data.name, audienceSegment: parsed.data.audienceSegment, message: parsed.data.message, benefitType: "INFORMATIONAL", status: "DRAFT" } });
      entityId = created.id;
    }
    if (parsed.data.module === "fidelidade") {
      const created = await db.reward.create({ data: { tenantId: session.tenantId, name: parsed.data.name, pointsCost: parsed.data.pointsCost, benefitType: parsed.data.benefitType } });
      entityId = created.id;
    }
    if (parsed.data.module === "financeiro") {
      const created = await db.expense.create({ data: { tenantId: session.tenantId, category: parsed.data.category, description: parsed.data.description, amountCents: Math.round(parsed.data.amount * 100), dueAt: new Date(`${parsed.data.dueAt}T00:00:00.000Z`) } });
      entityId = created.id;
    }

    await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "CREATE", entityType: slug, entityId, newValue: { source: "dashboard" } } });
    revalidatePath(`/${slug}`);
    revalidatePath("/painel");
    return { status: "success", message: "Registro salvo com sucesso." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode executar esta ação." };
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return { status: "error", message: "Já existe um registro com este valor único." };
    console.error("CREATE_MODULE_RECORD_FAILED", error);
    return { status: "error", message: "Não foi possível salvar. Revise os dados e tente novamente." };
  }
}

const editableModules = ["clientes", "equipe", "servicos", "produtos"] as const;
const updateSchema = z.object({ id: z.string().min(1), module: z.enum(editableModules) });

export async function updateModuleRecordAction(
  _state: ModuleActionState,
  formData: FormData,
): Promise<ModuleActionState> {
  const identity = updateSchema.safeParse(Object.fromEntries(formData));
  if (!identity.success) return { status: "error", message: "Registro inválido." };
  const slug = identity.data.module;
  const parsed = schemas[slug].safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: validationErrors(parsed.error) };

  try {
    const session = await authorizeAction(permissions[slug]);
    const db = tenantDb(session.tenantId);
    let previous: Record<string, string | number | null> | null = null;

    if (parsed.data.module === "clientes") {
      previous = await db.customer.findFirst({
        where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
        select: { firstName: true, lastName: true, email: true, phone: true },
      });
      if (previous) await db.customer.updateMany({
        where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
        data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName, email: parsed.data.email || null, phone: parsed.data.phone },
      });
    }

    if (parsed.data.module === "equipe") {
      previous = await db.staff.findFirst({
        where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
        select: { displayName: true, title: true, commissionBps: true, imageUrl: true },
      });
      if (previous) await db.staff.updateMany({
        where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
        data: { displayName: parsed.data.displayName, title: parsed.data.title, imageUrl: parsed.data.imageUrl || null, commissionBps: Math.round(parsed.data.commissionPercent * 100) },
      });
    }

    if (parsed.data.module === "servicos") {
      previous = await db.service.findFirst({
        where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
        select: { name: true, description: true, priceCents: true, durationMinutes: true },
      });
      if (previous) await db.service.updateMany({
        where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
        data: { name: parsed.data.name, description: parsed.data.description || null, priceCents: Math.round(parsed.data.price * 100), durationMinutes: parsed.data.durationMinutes },
      });
    }

    if (parsed.data.module === "produtos") {
      const productData = parsed.data;
      const current = await db.product.findFirst({
        where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
        select: { name: true, sku: true, category: true, priceCents: true, costCents: true, stock: true, minimumStock: true },
      });
      previous = current;
      if (current) await tenantTransaction(session.tenantId, async (tx) => {
        await tx.product.updateMany({
          where: { id: identity.data.id, tenantId: session.tenantId, deletedAt: null },
          data: { name: productData.name, sku: productData.sku.toUpperCase(), category: productData.category, priceCents: Math.round(productData.price * 100), costCents: Math.round(productData.cost * 100), stock: productData.stock, minimumStock: productData.minimumStock },
        });
        const difference = productData.stock - current.stock;
        if (difference !== 0) await tx.inventoryMovement.create({
          data: { tenantId: session.tenantId, productId: identity.data.id, type: "ADJUSTMENT", quantity: difference, reason: "Edição do cadastro do produto" },
        });
      });
    }

    if (!previous) return { status: "error", message: "Registro não encontrado neste ambiente." };
    await db.auditLog.create({
      data: { tenantId: session.tenantId, userId: session.userId, action: "UPDATE", entityType: slug, entityId: identity.data.id, previousValue: previous, newValue: parsed.data },
    });
    revalidatePath(`/${slug}`);
    revalidatePath("/painel");
    return { status: "success", message: "Alterações salvas com sucesso." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode editar este registro." };
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return { status: "error", message: "Já existe um registro com este valor único." };
    console.error("UPDATE_MODULE_RECORD_FAILED", error);
    return { status: "error", message: "Não foi possível salvar as alterações." };
  }
}

const settingsSchema = z.object({
  name: text("Nome"),
  address: text("Endereço"),
  phone: text("Telefone"),
  defaultDeposit: z.coerce.number().min(0).max(10_000),
  cancellationNoticeHours: z.coerce.number().int().min(0).max(720),
});

export async function updateSettingsAction(
  _state: ModuleActionState,
  formData: FormData,
): Promise<ModuleActionState> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: validationErrors(parsed.error) };
  try {
    const session = await authorizeAction("settings:edit");
    const db = tenantDb(session.tenantId);
    const previous = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId }, select: { name: true, address: true, phone: true, defaultDepositCents: true, cancellationNoticeHours: true } });
    await tenantTransaction(session.tenantId, async (tx) => {
      await tx.tenant.update({ where: { id: session.tenantId }, data: { name: parsed.data.name, address: parsed.data.address, phone: parsed.data.phone, defaultDepositCents: Math.round(parsed.data.defaultDeposit * 100), cancellationNoticeHours: parsed.data.cancellationNoticeHours } });
      await tx.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "UPDATE", entityType: "Tenant", entityId: session.tenantId, previousValue: previous, newValue: parsed.data } });
    });
    revalidatePath("/configuracoes");
    revalidatePath(`/barbearia/${session.tenantSlug}`);
    return { status: "success", message: "Configurações salvas no banco." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode alterar configurações." };
    console.error("UPDATE_SETTINGS_FAILED", error);
    return { status: "error", message: "Não foi possível salvar as configurações." };
  }
}

const archiveSchema = z.object({ id: z.string().min(1), module: z.enum(["clientes", "equipe", "servicos", "produtos"]) });

export async function archiveModuleRecordAction(_state: ModuleActionState, formData: FormData): Promise<ModuleActionState> {
  const parsed = archiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Registro inválido." };
  const permission = permissions[parsed.data.module];
  try {
    const session = await authorizeAction(permission);
    const db = tenantDb(session.tenantId);
    const now = new Date();
    let count = 0;
    if (parsed.data.module === "clientes") count = (await db.customer.updateMany({ where: { id: parsed.data.id, tenantId: session.tenantId, deletedAt: null }, data: { deletedAt: now, status: "ARCHIVED" } })).count;
    if (parsed.data.module === "equipe") count = (await db.staff.updateMany({ where: { id: parsed.data.id, tenantId: session.tenantId, deletedAt: null }, data: { deletedAt: now, isBookable: false } })).count;
    if (parsed.data.module === "servicos") count = (await db.service.updateMany({ where: { id: parsed.data.id, tenantId: session.tenantId, deletedAt: null }, data: { deletedAt: now, isActive: false } })).count;
    if (parsed.data.module === "produtos") count = (await db.product.updateMany({ where: { id: parsed.data.id, tenantId: session.tenantId, deletedAt: null }, data: { deletedAt: now, isActive: false } })).count;
    if (!count) return { status: "error", message: "Registro não encontrado neste ambiente." };
    await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "ARCHIVE", entityType: parsed.data.module, entityId: parsed.data.id } });
    revalidatePath(`/${parsed.data.module}`);
    return { status: "success", message: "Registro arquivado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode arquivar este registro." };
    console.error("ARCHIVE_RECORD_FAILED", error);
    return { status: "error", message: "Não foi possível arquivar o registro." };
  }
}

const inventorySchema = z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().refine((value) => value !== 0, "Informe uma quantidade diferente de zero."), reason: z.string().trim().min(2, "Informe o motivo.") });

export async function adjustInventoryAction(_state: ModuleActionState, formData: FormData): Promise<ModuleActionState> {
  const parsed = inventorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: validationErrors(parsed.error) };
  try {
    const session = await authorizeAction("products:edit");
    await tenantTransaction(session.tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: parsed.data.productId, tenantId: session.tenantId, deletedAt: null }, select: { id: true, stock: true } });
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      if (product.stock + parsed.data.quantity < 0) throw new Error("NEGATIVE_STOCK");
      await tx.product.update({ where: { id: product.id }, data: { stock: { increment: parsed.data.quantity } } });
      await tx.inventoryMovement.create({ data: { tenantId: session.tenantId, productId: product.id, type: "ADJUSTMENT", quantity: parsed.data.quantity, reason: parsed.data.reason } });
      await tx.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "ADJUST_STOCK", entityType: "Product", entityId: product.id, previousValue: { stock: product.stock }, newValue: { stock: product.stock + parsed.data.quantity } } });
    });
    revalidatePath("/produtos");
    revalidatePath("/painel");
    return { status: "success", message: "Estoque ajustado e movimento registrado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode ajustar estoque." };
    if (error instanceof Error && error.message === "NEGATIVE_STOCK") return { status: "error", message: "O ajuste deixaria o estoque negativo." };
    return { status: "error", message: "Não foi possível ajustar o estoque." };
  }
}

const redemptionSchema = z.object({ customerId: z.string().min(1) });

export async function redeemRewardAction(_state: ModuleActionState, formData: FormData): Promise<ModuleActionState> {
  const parsed = redemptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Cliente inválido." };
  try {
    const session = await authorizeAction("loyalty:edit");
    const db = tenantDb(session.tenantId);
    const customer = await db.customer.findFirst({ where: { id: parsed.data.customerId, tenantId: session.tenantId, deletedAt: null }, select: { id: true, loyaltyPoints: true } });
    if (!customer) return { status: "error", message: "Cliente não encontrado." };
    const reward = await db.reward.findFirst({ where: { tenantId: session.tenantId, isActive: true, pointsCost: { lte: customer.loyaltyPoints } }, orderBy: { pointsCost: "desc" } });
    if (!reward) return { status: "error", message: "Saldo insuficiente para as recompensas ativas." };
    await tenantTransaction(session.tenantId, async (tx) => {
      const updated = await tx.customer.updateMany({ where: { id: customer.id, tenantId: session.tenantId, loyaltyPoints: { gte: reward.pointsCost } }, data: { loyaltyPoints: { decrement: reward.pointsCost } } });
      if (!updated.count) throw new Error("INSUFFICIENT_POINTS");
      await tx.loyaltyTransaction.create({ data: { tenantId: session.tenantId, customerId: customer.id, type: "REDEEM", points: -reward.pointsCost, description: `Resgate: ${reward.name}` } });
      await tx.rewardRedemption.create({ data: { tenantId: session.tenantId, rewardId: reward.id, customerId: customer.id, pointsSpent: reward.pointsCost, status: "REDEEMED" } });
    });
    revalidatePath("/fidelidade");
    return { status: "success", message: `${reward.name} resgatado por ${reward.pointsCost} pontos.` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode resgatar recompensas." };
    return { status: "error", message: "Não foi possível concluir o resgate." };
  }
}
