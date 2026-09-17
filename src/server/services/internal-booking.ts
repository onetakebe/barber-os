import { randomUUID } from "node:crypto";

import { tenantTransaction } from "@/server/db";
import { getAvailabilityForTenant } from "@/server/data/public-booking";
import { BookingError, selectBookingSlot } from "@/server/services/booking";

export type CreateInternalBookingInput = {
  tenantId: string;
  timezone: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  phone: string;
  notes?: string;
  createdById: string;
};

/**
 * Reserva criada de dentro do estabelecimento (telefone, balcão, walk-in).
 * Difere da pública em três pontos deliberados: não cobra sinal, marca a origem como
 * INTERNAL e registra AuditLog com quem criou. A seleção de horário e a barreira de
 * conflito são as mesmas — o conflito é barrado pela exclusion constraint do banco,
 * não por consulta prévia, então sobrevive a duas recepcionistas marcando ao mesmo tempo.
 */
export async function createInternalBooking(input: CreateInternalBookingInput) {
  // A disponibilidade já valida o serviço (inativo/excluído → RESOURCE_NOT_FOUND) e o devolve.
  const availability = await getAvailabilityForTenant({
    tenantId: input.tenantId,
    timezone: input.timezone,
    date: input.date,
    serviceId: input.serviceId,
    staffId: input.staffId,
  });
  const [service] = availability.services.items;
  const selected = selectBookingSlot(availability.slots, input.time, input.staffId);
  const appointmentId = randomUUID();

  try {
    return await tenantTransaction(input.tenantId, async (tx) => {
      const customer = await tx.customer.upsert({
        where: { tenantId_phone: { tenantId: input.tenantId, phone: input.phone } },
        update: { firstName: input.firstName, lastName: input.lastName },
        create: { tenantId: input.tenantId, firstName: input.firstName, lastName: input.lastName, phone: input.phone },
      });
      const appointment = await tx.appointment.create({
        data: {
          id: appointmentId,
          tenantId: input.tenantId,
          customerId: customer.id,
          staffId: selected.staffId,
          startsAt: new Date(selected.startsAt),
          endsAt: new Date(selected.endsAt),
          status: "CONFIRMED",
          source: "INTERNAL",
          totalCents: service.priceCents,
          depositCents: 0,
          notes: input.notes || null,
          services: { create: { tenantId: input.tenantId, serviceId: service.id, priceCents: service.priceCents, durationMinutes: service.durationMinutes } },
          statusHistory: { create: { tenantId: input.tenantId, toStatus: "CONFIRMED", reason: "Agendamento criado pelo painel", changedById: input.createdById } },
        },
        select: { id: true, startsAt: true, staff: { select: { displayName: true } } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          userId: input.createdById,
          action: "CREATE",
          entityType: "Appointment",
          entityId: appointment.id,
          newValue: { source: "INTERNAL", serviceId: service.id, staffId: selected.staffId, startsAt: appointment.startsAt },
        },
      });
      return {
        appointmentId: appointment.id,
        serviceName: service.name,
        staffName: appointment.staff.displayName,
        startsAt: appointment.startsAt,
        totalCents: service.priceCents,
        customerName: `${customer.firstName} ${customer.lastName}`,
      };
    });
  } catch (error) {
    const details = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    if (details.includes("Appointment_staff_active_time_excl") || details.includes("23P01") || details.includes("ExclusionConstraintViolation")) throw new BookingError("SLOT_CONFLICT");
    throw error;
  }
}
