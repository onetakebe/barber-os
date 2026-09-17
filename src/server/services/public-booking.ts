import { randomUUID } from "node:crypto";

import { adminDb, tenantTransaction } from "@/server/db";
import { getAvailabilityForTenant, getBookingWindow } from "@/server/data/public-booking";
import { BOOKING_CONFIRMED_TEMPLATE_KEY, bookingConfirmedEventKey, buildBookingConfirmedEvent, summarizeBookingConfirmed } from "@/server/notifications/booking-confirmed";
import { BookingError, selectBookingSlot } from "@/server/services/booking";

export type CreatePublicBookingInput = {
  slug: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  /** Destinatário da confirmação: sem e-mail não há reserva pública. */
  email: string;
  phone: string;
};

/**
 * Reserva pública: um agendamento com um item `AppointmentService` por serviço escolhido, todos
 * com o mesmo barbeiro em sequência. Seleção, janela e horário são revalidados aqui — o wizard
 * só esconde o que não pode; quem forjar o formulário esbarra nas mesmas regras. O conflito de
 * horário é barrado pela exclusion constraint do banco, não por consulta prévia, então
 * sobrevive a duas reservas simultâneas. A confirmação por e-mail entra na mesma transação
 * como `Notification` QUEUED com o snapshot do evento; o envio acontece depois do commit
 * (`dispatchNotification`), e se a transação cair não sobra nem agendamento nem notificação.
 */
export async function createPublicBooking(input: CreatePublicBookingInput) {
  const tenant = await adminDb.tenant.findFirst({ where: { slug: input.slug, deletedAt: null }, select: { id: true, name: true, address: true, phone: true, email: true, timezone: true, currency: true, cancellationNoticeHours: true } });
  if (!tenant) throw new BookingError("RESOURCE_NOT_FOUND");
  // Janela pública (hoje–hoje+60) também vale no servidor; o calendário só a esconde.
  const window = getBookingWindow(tenant.timezone);
  if (input.date < window.today || input.date > window.last) throw new BookingError("OUTSIDE_WINDOW");

  // A disponibilidade já resolve (e valida) os serviços: itens, duração somada e total.
  const availability = await getAvailabilityForTenant({ tenantId: tenant.id, timezone: tenant.timezone, date: input.date, serviceIds: input.serviceIds, staffId: input.staffId, now: new Date() });
  const services = availability.services;
  const selected = selectBookingSlot(availability.slots, input.time, input.staffId);
  const appointmentId = randomUUID();
  // Sem adquirente real não há sinal online (decisão de 13/09): a reserva confirma sem cobrar.
  // `Service.depositRequired` e `Tenant.defaultDepositCents` seguem no cadastro para quando houver.

  try {
    return await tenantTransaction(tenant.id, async (tx) => {
      const customer = await tx.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: input.phone } },
        update: { firstName: input.firstName, lastName: input.lastName, email: input.email },
        create: { tenantId: tenant.id, firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone },
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
          totalCents: services.totalCents,
          depositCents: 0,
          services: { create: services.items.map((item) => ({ tenantId: tenant.id, serviceId: item.id, priceCents: item.priceCents, durationMinutes: item.durationMinutes })) },
          statusHistory: { create: { tenantId: tenant.id, toStatus: "CONFIRMED", reason: "Reserva pública confirmada" } },
        },
        select: { id: true, startsAt: true, endsAt: true, staff: { select: { displayName: true } } },
      });
      // Snapshot do que foi persistido: quem lê a fila depois não precisa (nem deve) reconsultar.
      const event = buildBookingConfirmedEvent({
        appointmentId: appointment.id,
        tenantId: tenant.id,
        customerId: customer.id,
        customer: { firstName: input.firstName, lastName: input.lastName, email: input.email },
        business: { name: tenant.name, address: tenant.address, phone: tenant.phone, email: tenant.email },
        staffName: appointment.staff.displayName,
        services: services.items,
        totalCents: services.totalCents,
        currency: tenant.currency,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        timezone: tenant.timezone,
        cancellationNoticeHours: tenant.cancellationNoticeHours,
      });
      const notification = await tx.notification.create({
        data: { tenantId: tenant.id, customerId: customer.id, channel: "EMAIL", status: "QUEUED", recipient: input.email, templateKey: BOOKING_CONFIRMED_TEMPLATE_KEY, eventKey: bookingConfirmedEventKey(appointment.id), ...summarizeBookingConfirmed(event), metadata: event },
        select: { id: true },
      });
      return {
        appointmentId: appointment.id,
        notificationId: notification.id,
        tenantId: tenant.id,
        customerId: customer.id,
        businessName: tenant.name,
        timezone: tenant.timezone,
        services: services.items,
        staffName: appointment.staff.displayName,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        durationMinutes: services.durationMinutes,
        currency: tenant.currency,
        totalCents: services.totalCents,
        cancellationNoticeHours: tenant.cancellationNoticeHours,
      };
    });
  } catch (error) {
    const details = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    if (details.includes("Appointment_staff_active_time_excl") || details.includes("23P01") || details.includes("ExclusionConstraintViolation")) throw new BookingError("SLOT_CONFLICT");
    throw error;
  }
}
