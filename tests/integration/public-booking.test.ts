import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminDb, tenantDb } from "@/server/db";
import { createPublicBooking } from "@/server/services/public-booking";

/* Bloco 1 / T1: sem adquirente real não existe sinal online. A reserva pública confirma sem
   cobrar e não grava pagamento nem depósito, mesmo quando o serviço pede sinal. Roda contra o
   banco real do .env, numa barbearia temporária apagada no fim. */
describe.sequential("reserva pública sem sinal online", () => {
  const slug = `reserva-sem-sinal-${Date.now()}`;
  let tenantId: string;
  let serviceId: string;
  let appointmentId: string;
  const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    const tenant = await adminDb.tenant.create({ data: { name: "Reserva sem sinal", slug, email: "sem-sinal@exemplo.com", defaultDepositCents: 1000 }, select: { id: true } });
    tenantId = tenant.id;
    const db = tenantDb(tenantId);
    const category = await db.serviceCategory.create({ data: { tenantId, name: "Cortes" }, select: { id: true } });
    const service = await db.service.create({ data: { tenantId, categoryId: category.id, name: "Corte", priceCents: 3000, durationMinutes: 30, depositRequired: true }, select: { id: true } });
    serviceId = service.id;
    const staff = await db.staff.create({ data: { tenantId, displayName: "Barbeiro Teste" }, select: { id: true } });
    await db.staffService.create({ data: { tenantId, staffId: staff.id, serviceId } });
    await db.availability.createMany({ data: Array.from({ length: 7 }, (_, dayOfWeek) => ({ tenantId, staffId: staff.id, dayOfWeek, startMinute: 540, endMinute: 1020 })) });
  });

  afterAll(async () => {
    // AppointmentService → Service é Restrict: apagar o agendamento antes da barbearia.
    await adminDb.appointment.deleteMany({ where: { tenantId } });
    await adminDb.tenant.delete({ where: { id: tenantId } });
  });

  it("confirma o agendamento sem cobrar e sem gravar pagamento ou depósito", async () => {
    const booking = await createPublicBooking({ slug, serviceId, staffId: "any", date, time: "10:00", firstName: "Cliente", lastName: "Teste", phone: "+32 470 11 22 33" });
    appointmentId = booking.appointmentId;
    expect(booking).not.toHaveProperty("depositCents");

    const db = tenantDb(tenantId);
    const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId }, select: { status: true, depositCents: true, totalCents: true } });
    expect(appointment).toEqual({ status: "CONFIRMED", depositCents: 0, totalCents: 3000 });
    expect(await db.payment.count({ where: { appointmentId } })).toBe(0);
    expect(await db.deposit.count({ where: { appointmentId } })).toBe(0);
  });
});
