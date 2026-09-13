"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveCancellation } from "@/domain/finance/deposits";
import { parseAvailabilityWindow } from "@/domain/scheduling/availability-rules";
import { AuthorizationError, authorizeAction } from "@/server/auth/authorization";
import { tenantDb, tenantTransaction } from "@/server/db";
import { localDateTimeToUtc } from "@/server/services/availability";
import { BookingError } from "@/server/services/booking";
import { createInternalBooking } from "@/server/services/internal-booking";

export type AgendaActionState = { status: "idle" | "success" | "error"; message?: string };
const schema = z.object({ appointmentId: z.string().min(1), reason: z.string().trim().max(300).optional() });
const cancellableStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export async function cancelAppointmentAction(_state: AgendaActionState, formData: FormData): Promise<AgendaActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Agendamento inválido." };
  try {
    const session = await authorizeAction("appointments:edit");
    const db = tenantDb(session.tenantId);
    const appointment = await db.appointment.findFirst({ where: { id: parsed.data.appointmentId, tenantId: session.tenantId, deletedAt: null }, include: { deposit: true, tenant: { select: { cancellationNoticeHours: true } } } });
    if (!appointment) return { status: "error", message: "Agendamento não encontrado." };
    if (!cancellableStatuses.includes(appointment.status as (typeof cancellableStatuses)[number])) return { status: "error", message: "Este agendamento não pode mais ser cancelado." };
    const cancellation = resolveCancellation({ appointmentAt: appointment.startsAt, cancelledAt: new Date(), noticeHours: appointment.tenant.cancellationNoticeHours, depositCents: appointment.deposit?.amountCents ?? 0 });

    await tenantTransaction(session.tenantId, async (tx) => {
      const changed = await tx.appointment.updateMany({
        where: { id: appointment.id, tenantId: session.tenantId, deletedAt: null, status: { in: [...cancellableStatuses] } },
        data: { status: "CANCELLED_BY_BUSINESS" },
      });
      if (!changed.count) throw new Error("APPOINTMENT_ALREADY_CANCELLED");
      await tx.appointmentStatusHistory.create({ data: { tenantId: session.tenantId, appointmentId: appointment.id, fromStatus: appointment.status, toStatus: "CANCELLED_BY_BUSINESS", reason: parsed.data.reason || "Cancelado pelo estabelecimento", changedById: session.userId } });
      if (appointment.deposit) {
        await tx.deposit.update({ where: { id: appointment.deposit.id }, data: { status: cancellation.status === "CONVERTED_TO_CREDIT" ? "CONVERTED_TO_CREDIT" : "RETAINED_NO_SHOW" } });
        if (cancellation.creditCents > 0) await tx.credit.create({ data: { tenantId: session.tenantId, customerId: appointment.customerId, amountCents: cancellation.creditCents, balanceCents: cancellation.creditCents, reason: `Cancelamento ${appointment.id}` } });
      }
      await tx.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "CANCEL", entityType: "Appointment", entityId: appointment.id, previousValue: { status: appointment.status }, newValue: { status: "CANCELLED_BY_BUSINESS", deposit: cancellation.status } } });
    });
    revalidatePath("/agenda");
    revalidatePath("/agendamentos");
    revalidatePath("/painel");
    return { status: "success", message: cancellation.status === "CONVERTED_TO_CREDIT" ? "Cancelado. O sinal virou crédito." : "Cancelado. O sinal foi retido pela política." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode cancelar reservas." };
    if (error instanceof Error && error.message === "APPOINTMENT_ALREADY_CANCELLED") return { status: "error", message: "Este agendamento já foi cancelado." };
    console.error("CANCEL_APPOINTMENT_FAILED", error);
    return { status: "error", message: "Não foi possível cancelar o agendamento." };
  }
}

const createSchema = z.object({
  serviceId: z.string().min(1, "Escolha o serviço."),
  staffId: z.string().min(1, "Escolha o profissional."),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
  firstName: z.string().trim().min(2, "Informe o nome do cliente."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
  phone: z.string().trim().min(7, "Informe o telefone."),
  notes: z.string().trim().max(300).optional(),
});

export async function createAppointmentAction(_state: AgendaActionState, formData: FormData): Promise<AgendaActionState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { status: "error", message: first ?? "Revise os dados do agendamento." };
  }
  try {
    const session = await authorizeAction("appointments:edit");
    const db = tenantDb(session.tenantId);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId }, select: { timezone: true } });
    const booking = await createInternalBooking({
      tenantId: session.tenantId,
      timezone: tenant.timezone,
      createdById: session.userId,
      ...parsed.data,
    });
    revalidatePath("/agenda");
    revalidatePath("/agendamentos");
    revalidatePath("/painel");
    revalidatePath(`/barbearia/${session.tenantSlug}/agendar`);
    const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" }).format(booking.startsAt);
    return { status: "success", message: `${booking.serviceName} marcado para ${booking.customerName} com ${booking.staffName} às ${hora}.` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode criar agendamentos." };
    if (error instanceof BookingError && error.code === "SLOT_CONFLICT") return { status: "error", message: "Este horário acabou de ser ocupado. Escolha outro." };
    if (error instanceof BookingError && error.code === "RESOURCE_NOT_FOUND") return { status: "error", message: "Serviço não está mais disponível." };
    console.error("CREATE_APPOINTMENT_FAILED", error);
    return { status: "error", message: "Não foi possível criar o agendamento." };
  }
}

const availabilitySchema = z.object({
  staffId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  enabled: z.enum(["true", "false"]),
  start: z.string(),
  end: z.string(),
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
});

export async function saveAvailabilityAction(_state: AgendaActionState, formData: FormData): Promise<AgendaActionState> {
  const parsed = availabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Revise a jornada informada." };
  try {
    const session = await authorizeAction("team:edit");
    const db = tenantDb(session.tenantId);
    const staff = await db.staff.findFirst({ where: { id: parsed.data.staffId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
    if (!staff) return { status: "error", message: "Profissional não encontrado neste ambiente." };

    const window = parsed.data.enabled === "true" ? parseAvailabilityWindow(parsed.data) : null;
    await tenantTransaction(session.tenantId, async (tx) => {
      const previous = await tx.availability.findMany({ where: { tenantId: session.tenantId, staffId: staff.id, dayOfWeek: parsed.data.dayOfWeek } });
      await tx.availability.deleteMany({ where: { tenantId: session.tenantId, staffId: staff.id, dayOfWeek: parsed.data.dayOfWeek } });
      if (window) await tx.availability.create({ data: { tenantId: session.tenantId, staffId: staff.id, dayOfWeek: parsed.data.dayOfWeek, ...window } });
      await tx.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "UPDATE_AVAILABILITY", entityType: "Staff", entityId: staff.id, previousValue: previous, newValue: window ? { dayOfWeek: parsed.data.dayOfWeek, ...window } : { dayOfWeek: parsed.data.dayOfWeek, closed: true } } });
    });
    revalidatePath("/agenda");
    revalidatePath(`/barbearia/${session.tenantSlug}/agendar`);
    return { status: "success", message: window ? "Jornada atualizada." : "Dia marcado como indisponível." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode alterar jornadas." };
    if (error instanceof Error && ["INVALID_TIME", "INVALID_WORKDAY", "INVALID_BREAK"].includes(error.message)) return { status: "error", message: "Os horários ou o intervalo não formam uma jornada válida." };
    console.error("SAVE_AVAILABILITY_FAILED", error);
    return { status: "error", message: "Não foi possível atualizar a jornada." };
  }
}

const timeOffSchema = z.object({
  staffId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  reason: z.string().trim().min(2).max(200),
});

function parseLocalDateTime(value: string, timezone: string) {
  const [date, time] = value.split("T");
  if (!date || !time) throw new Error("INVALID_TIME_OFF");
  return localDateTimeToUtc(date, time, timezone);
}

export async function createTimeOffAction(_state: AgendaActionState, formData: FormData): Promise<AgendaActionState> {
  const parsed = timeOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Preencha o período e o motivo do bloqueio." };
  try {
    const session = await authorizeAction("team:edit");
    const db = tenantDb(session.tenantId);
    const [tenant, staff] = await Promise.all([
      db.tenant.findUniqueOrThrow({ where: { id: session.tenantId }, select: { timezone: true } }),
      db.staff.findFirst({ where: { id: parsed.data.staffId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!staff) return { status: "error", message: "Profissional não encontrado neste ambiente." };
    const startsAt = parseLocalDateTime(parsed.data.startsAt, tenant.timezone);
    const endsAt = parseLocalDateTime(parsed.data.endsAt, tenant.timezone);
    if (endsAt <= startsAt) return { status: "error", message: "O fim deve ser posterior ao início." };
    const block = await db.timeOff.create({ data: { tenantId: session.tenantId, staffId: staff.id, startsAt, endsAt, reason: parsed.data.reason } });
    await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "CREATE_TIME_OFF", entityType: "TimeOff", entityId: block.id, newValue: { staffId: staff.id, startsAt, endsAt, reason: parsed.data.reason } } });
    revalidatePath("/agenda");
    revalidatePath(`/barbearia/${session.tenantSlug}/agendar`);
    return { status: "success", message: "Bloqueio registrado; esse período não será oferecido online." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode criar bloqueios." };
    console.error("CREATE_TIME_OFF_FAILED", error);
    return { status: "error", message: "Não foi possível registrar o bloqueio." };
  }
}

const removeTimeOffSchema = z.object({ timeOffId: z.string().min(1) });

export async function removeTimeOffAction(_state: AgendaActionState, formData: FormData): Promise<AgendaActionState> {
  const parsed = removeTimeOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Bloqueio inválido." };
  try {
    const session = await authorizeAction("team:edit");
    const db = tenantDb(session.tenantId);
    const removed = await db.timeOff.deleteMany({ where: { id: parsed.data.timeOffId, tenantId: session.tenantId } });
    if (!removed.count) return { status: "error", message: "Bloqueio não encontrado neste ambiente." };
    await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "DELETE_TIME_OFF", entityType: "TimeOff", entityId: parsed.data.timeOffId } });
    revalidatePath("/agenda");
    revalidatePath(`/barbearia/${session.tenantSlug}/agendar`);
    return { status: "success", message: "Bloqueio removido." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { status: "error", message: "Seu perfil não pode remover bloqueios." };
    return { status: "error", message: "Não foi possível remover o bloqueio." };
  }
}
