"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthorizationError, authorizeAction } from "@/server/auth/authorization";
import { getPublicAvailability } from "@/server/data/public-booking";
import { tenantDb, tenantTransaction } from "@/server/db";
import { MockWhatsAppProvider } from "@/server/integrations/messaging";
import { BookingError } from "@/server/services/booking";

export type WaitlistActionState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string[]> };

const createSchema = z.object({
  customerId: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().optional(),
  desiredDate: z.iso.date(),
  windowStartMinute: z.coerce.number().int().min(0).max(1439),
  windowEndMinute: z.coerce.number().int().min(1).max(1440),
}).refine((value) => value.windowEndMinute > value.windowStartMinute, { path: ["windowEndMinute"], message: "A janela final deve ser posterior à inicial." });

export async function createWaitlistEntryAction(_state: WaitlistActionState, formData: FormData): Promise<WaitlistActionState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const session = await authorizeAction("waitlist:edit");
    const db = tenantDb(session.tenantId);
    const [customer, service, staff] = await Promise.all([
      db.customer.findFirst({ where: { id: parsed.data.customerId, tenantId: session.tenantId, deletedAt: null }, select: { id: true, loyaltyPoints: true } }),
      db.service.findFirst({ where: { id: parsed.data.serviceId, tenantId: session.tenantId, deletedAt: null, isActive: true }, select: { id: true } }),
      parsed.data.staffId ? db.staff.findFirst({ where: { id: parsed.data.staffId, tenantId: session.tenantId, deletedAt: null, isBookable: true }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (!customer || !service || (parsed.data.staffId && !staff)) return { status: "error", message: "Cliente, serviço ou profissional não pertence a este ambiente." };
    await db.waitlistEntry.create({ data: { tenantId: session.tenantId, customerId: customer.id, serviceId: service.id, staffId: staff?.id, desiredDate: new Date(`${parsed.data.desiredDate}T00:00:00.000Z`), windowStartMinute: parsed.data.windowStartMinute, windowEndMinute: parsed.data.windowEndMinute, priorityScore: Math.min(100, 50 + Math.floor(customer.loyaltyPoints / 100)) } });
    revalidatePath("/fila-de-espera");
    return { status: "success", message: "Cliente incluído na fila." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode alterar a fila." };
    console.error("CREATE_WAITLIST_FAILED", error);
    return { status: "error", message: "Não foi possível incluir o cliente." };
  }
}

const offerSchema = z.object({ entryId: z.string().min(1) });

export async function offerWaitlistSlotAction(_state: WaitlistActionState, formData: FormData): Promise<WaitlistActionState> {
  const parsed = offerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Entrada inválida." };
  try {
    const session = await authorizeAction("waitlist:edit");
    const db = tenantDb(session.tenantId);
    const entry = await db.waitlistEntry.findFirst({ where: { id: parsed.data.entryId, tenantId: session.tenantId }, include: { tenant: { select: { slug: true } }, customer: { select: { id: true, firstName: true, phone: true } }, service: { select: { id: true, name: true } } } });
    if (!entry || entry.status !== "WAITING") return { status: "error", message: "Esta entrada não está mais aguardando." };
    const date = entry.desiredDate.toISOString().slice(0, 10);
    const availability = await getPublicAvailability({ slug: entry.tenant.slug, date, serviceId: entry.serviceId, staffId: entry.staffId ?? "any" });
    const now = new Date();
    const slot = availability?.slots.find((candidate) => {
      const [hour, minute] = candidate.time.split(":").map(Number);
      const minuteOfDay = hour * 60 + minute;
      return minuteOfDay >= entry.windowStartMinute && minuteOfDay <= entry.windowEndMinute && new Date(candidate.startsAt).getTime() - now.getTime() >= entry.minimumNoticeMinutes * 60_000;
    });
    if (!slot) return { status: "error", message: "Nenhum horário compatível está disponível nesta janela." };
    const message = await new MockWhatsAppProvider().send({ recipient: entry.customer.phone, templateKey: "waitlist_offer", variables: { firstName: entry.customer.firstName, service: entry.service.name, time: slot.time } });
    const expiresAt = new Date(now.getTime() + 10 * 60_000);
    await tenantTransaction(session.tenantId, async (tx) => {
      const claimed = await tx.waitlistEntry.updateMany({ where: { id: entry.id, tenantId: session.tenantId, status: "WAITING" }, data: { status: "OFFERED" } });
      if (!claimed.count) throw new Error("WAITLIST_ALREADY_OFFERED");
      await tx.waitlistOffer.create({ data: { tenantId: session.tenantId, waitlistEntryId: entry.id, offeredStartsAt: new Date(slot.startsAt), expiresAt, status: "OFFERED" } });
      await tx.notification.create({ data: { tenantId: session.tenantId, customerId: entry.customer.id, channel: "WHATSAPP", status: "SENT", title: "Vaga disponível", body: `${entry.service.name} disponível às ${slot.time}. Oferta válida por 10 minutos.`, metadata: { simulated: true, messageId: message.messageId }, sentAt: now } });
    });
    revalidatePath("/fila-de-espera");
    return { status: "success", message: "Oferta simulada enviada e persistida." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode oferecer vagas." };
    if (error instanceof Error && error.message === "WAITLIST_ALREADY_OFFERED") return { status: "error", message: "Esta vaga já foi oferecida por outra sessão." };
    // Serviço da entrada desativado/excluído depois de ela entrar na fila.
    if (error instanceof BookingError) return { status: "error", message: "O serviço desta entrada não está mais disponível." };
    console.error("OFFER_WAITLIST_FAILED", error);
    return { status: "error", message: "Não foi possível oferecer a vaga." };
  }
}
