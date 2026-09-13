import { randomUUID } from "node:crypto";

import { adminDb, tenantDb, tenantTransaction } from "@/server/db";
import { getPublicAvailability } from "@/server/data/public-booking";
import { BookingError, selectBookingSlot } from "@/server/services/booking";

export type CreatePublicBookingInput = {
  slug: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
};

export async function createPublicBooking(input: CreatePublicBookingInput) {
  const tenant = await adminDb.tenant.findFirst({ where: { slug: input.slug, deletedAt: null }, select: { id: true, cancellationNoticeHours: true } });
  if (!tenant) throw new BookingError("RESOURCE_NOT_FOUND");
  const db = tenantDb(tenant.id);
  const service = await db.service.findFirst({ where: { id: input.serviceId, tenantId: tenant.id, isActive: true, deletedAt: null }, select: { id: true, name: true, priceCents: true, durationMinutes: true } });
  if (!service) throw new BookingError("RESOURCE_NOT_FOUND");

  const availability = await getPublicAvailability({ slug: input.slug, date: input.date, serviceId: service.id, staffId: input.staffId });
  if (!availability) throw new BookingError("RESOURCE_NOT_FOUND");
  const selected = selectBookingSlot(availability.slots, input.time, input.staffId);
  const appointmentId = randomUUID();
  // Sem adquirente real não há sinal online (decisão de 13/09): a reserva confirma sem cobrar.
  // `Service.depositRequired` e `Tenant.defaultDepositCents` seguem no cadastro para quando houver.

  try {
    return await tenantTransaction(tenant.id, async (tx) => {
      const customer = await tx.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: input.phone } },
        update: { firstName: input.firstName, lastName: input.lastName, email: input.email || null },
        create: { tenantId: tenant.id, firstName: input.firstName, lastName: input.lastName, email: input.email || null, phone: input.phone },
      });
      const appointment = await tx.appointment.create({
        data: {
          id: appointmentId,
          tenantId: tenant.id,
          customerId: customer.id,
          staffId: selected.staffId,
          startsAt: new Date(selected.startsAt),
          endsAt: new Date(selected.endsAt),
          status: "CONFIRMED",
          source: "ONLINE",
          totalCents: service.priceCents,
          depositCents: 0,
          services: { create: { tenantId: tenant.id, serviceId: service.id, priceCents: service.priceCents, durationMinutes: service.durationMinutes } },
          statusHistory: { create: { tenantId: tenant.id, toStatus: "CONFIRMED", reason: "Reserva pública confirmada" } },
        },
        select: { id: true, startsAt: true, staff: { select: { displayName: true } } },
      });
      await tx.notification.create({ data: { tenantId: tenant.id, customerId: customer.id, channel: "EMAIL", status: "SENT", title: "Reserva confirmada", body: `${service.name} confirmado para ${input.date} às ${input.time}. Envio simulado.`, metadata: { simulated: true }, sentAt: new Date() } });
      return { appointmentId: appointment.id, serviceName: service.name, staffName: appointment.staff.displayName, startsAt: appointment.startsAt, totalCents: service.priceCents, cancellationNoticeHours: tenant.cancellationNoticeHours };
    });
  } catch (error) {
    const details = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    if (details.includes("Appointment_staff_active_time_excl") || details.includes("23P01") || details.includes("ExclusionConstraintViolation")) throw new BookingError("SLOT_CONFLICT");
    throw error;
  }
}
