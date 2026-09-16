import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminDb, tenantDb } from "@/server/db";
import { getAvailabilityForTenant, getBookableDaysForTenant, getNextPublicSlot } from "@/server/data/public-booking";
import { BookingError } from "@/server/services/booking";
import { resolveBookingServices } from "@/server/services/booking-services";
import { createPublicBooking } from "@/server/services/public-booking";

/* Reserva pública com vários serviços (Bloco 1 / ticket 1) sobre a regra de T1: sem adquirente
   real não existe sinal online, a reserva confirma sem cobrar e não grava pagamento nem
   depósito. Roda contra o banco real do .env, em duas barbearias temporárias apagadas no fim. */
describe.sequential("reserva pública com vários serviços", () => {
  const stamp = Date.now();
  const slug = `reserva-multi-${stamp}`;
  const timezone = "Europe/Brussels";
  let tenantId: string;
  let otherTenantId: string;
  let otherServiceId: string;
  let inactiveServiceId: string;
  let fullStaffId: string;
  let partialStaffId: string;
  const services: Record<"corte" | "barba" | "sobrancelha", string> = { corte: "", barba: "", sobrancelha: "" };
  const all = () => [services.corte, services.barba, services.sobrancelha];
  const dateAfter = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const date = dateAfter(14);

  beforeAll(async () => {
    const tenant = await adminDb.tenant.create({ data: { name: "Reserva multi", slug, email: `multi-${stamp}@exemplo.com`, timezone, defaultDepositCents: 1000 }, select: { id: true } });
    tenantId = tenant.id;
    const db = tenantDb(tenantId);
    const category = await db.serviceCategory.create({ data: { tenantId, name: "Cortes" }, select: { id: true } });
    const create = (name: string, priceCents: number, durationMinutes: number, isActive = true) =>
      db.service.create({ data: { tenantId, categoryId: category.id, name, priceCents, durationMinutes, depositRequired: true, isActive }, select: { id: true } }).then((row) => row.id);
    services.corte = await create("Corte", 3000, 30);
    services.barba = await create("Barba", 1500, 20);
    services.sobrancelha = await create("Sobrancelha", 500, 10);
    inactiveServiceId = await create("Desativado", 900, 15, false);

    // "Completo" faz os três; "Parcial" só o corte. Ambos trabalham todo dia, 09:00–17:00.
    const full = await db.staff.create({ data: { tenantId, displayName: "Completo" }, select: { id: true } });
    const partial = await db.staff.create({ data: { tenantId, displayName: "Parcial" }, select: { id: true } });
    fullStaffId = full.id;
    partialStaffId = partial.id;
    await db.staffService.createMany({ data: [...all().map((serviceId) => ({ tenantId, staffId: fullStaffId, serviceId })), { tenantId, staffId: partialStaffId, serviceId: services.corte }] });
    await db.availability.createMany({ data: [fullStaffId, partialStaffId].flatMap((staffId) => Array.from({ length: 7 }, (_, dayOfWeek) => ({ tenantId, staffId, dayOfWeek, startMinute: 540, endMinute: 1020 }))) });

    const other = await adminDb.tenant.create({ data: { name: "Outra barbearia", slug: `outra-${stamp}`, email: `outra-${stamp}@exemplo.com` }, select: { id: true } });
    otherTenantId = other.id;
    const otherCategory = await tenantDb(otherTenantId).serviceCategory.create({ data: { tenantId: otherTenantId, name: "Cortes" }, select: { id: true } });
    otherServiceId = (await tenantDb(otherTenantId).service.create({ data: { tenantId: otherTenantId, categoryId: otherCategory.id, name: "Corte alheio", priceCents: 100, durationMinutes: 10 }, select: { id: true } })).id;
  });

  afterAll(async () => {
    // AppointmentService → Service é Restrict: apagar os agendamentos antes das barbearias.
    await adminDb.appointment.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await adminDb.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
  });

  describe("resolveBookingServices", () => {
    it("soma duração e preço dos serviços escolhidos, na ordem pedida", async () => {
      const resolved = await resolveBookingServices(tenantDb(tenantId), tenantId, all());
      expect(resolved.items.map((item) => [item.name, item.priceCents, item.durationMinutes])).toEqual([["Corte", 3000, 30], ["Barba", 1500, 20], ["Sobrancelha", 500, 10]]);
      expect(resolved.durationMinutes).toBe(60);
      expect(resolved.totalCents).toBe(5000);
    });

    it("rejeita lista vazia e ids repetidos", async () => {
      await expect(resolveBookingServices(tenantDb(tenantId), tenantId, [])).rejects.toThrow(new BookingError("INVALID_SERVICES"));
      await expect(resolveBookingServices(tenantDb(tenantId), tenantId, [services.corte, services.corte])).rejects.toThrow(new BookingError("INVALID_SERVICES"));
    });

    it("rejeita serviço inativo e serviço de outra barbearia", async () => {
      await expect(resolveBookingServices(tenantDb(tenantId), tenantId, [services.corte, inactiveServiceId])).rejects.toThrow(new BookingError("RESOURCE_NOT_FOUND"));
      await expect(resolveBookingServices(tenantDb(tenantId), tenantId, [services.corte, otherServiceId])).rejects.toThrow(new BookingError("RESOURCE_NOT_FOUND"));
    });
  });

  describe("disponibilidade", () => {
    it("só lista profissionais habilitados em todos os serviços e usa a duração somada", async () => {
      const availability = await getAvailabilityForTenant({ tenantId, timezone, date, serviceIds: all(), staffId: "any" });
      expect(availability.durationMinutes).toBe(60);
      expect(availability.slots.length).toBeGreaterThan(0);
      expect(availability.slots.every((slot) => slot.staffIds.includes(fullStaffId) && !slot.staffIds.includes(partialStaffId))).toBe(true);
      // 60 minutos numa jornada até 17:00: o último início possível é 16:00.
      expect(availability.slots.at(-1)?.time).toBe("16:00");

      const single = await getAvailabilityForTenant({ tenantId, timezone, date, serviceIds: [services.corte], staffId: "any" });
      expect(single.slots[0]?.staffIds).toEqual(expect.arrayContaining([fullStaffId, partialStaffId]));
      expect(single.slots.at(-1)?.time).toBe("16:30");
    });

    it("não deixa forçar um profissional sem uma das habilitações", async () => {
      const availability = await getAvailabilityForTenant({ tenantId, timezone, date, serviceIds: all(), staffId: partialStaffId });
      expect(availability.slots).toEqual([]);
    });

    it("continua aceitando o serviceId único dos consumidores internos", async () => {
      const day = await getAvailabilityForTenant({ tenantId, timezone, date, serviceId: services.corte, staffId: "any" });
      expect(day.serviceIds).toEqual([services.corte]);
      expect(day.slots.length).toBeGreaterThan(0);
      const month = await getBookableDaysForTenant({ tenantId, timezone, month: date.slice(0, 7), serviceId: services.corte, staffId: "any" });
      expect(month.days.find((item) => item.date === date)?.available).toBe(true);
      const next = await getNextPublicSlot({ tenantId, timezone, serviceId: services.corte });
      expect(next).not.toBeNull();
    });
  });

  describe("createPublicBooking", () => {
    it("grava um agendamento com três itens, 60 minutos e 5.000 centavos, sem cobrar", async () => {
      const booking = await createPublicBooking({ slug, serviceIds: all(), staffId: "any", date, time: "10:00", firstName: "Cliente", lastName: "Teste", phone: "+32 470 11 22 33" });
      expect(booking).not.toHaveProperty("depositCents");
      expect(booking).not.toHaveProperty("serviceName");
      expect(booking.services.map((item) => item.name)).toEqual(["Corte", "Barba", "Sobrancelha"]);
      expect(booking.durationMinutes).toBe(60);
      expect(booking.totalCents).toBe(5000);
      expect(booking.currency).toBe("EUR");
      expect(booking.endsAt.getTime() - booking.startsAt.getTime()).toBe(60 * 60_000);

      const db = tenantDb(tenantId);
      const appointment = await db.appointment.findUniqueOrThrow({ where: { id: booking.appointmentId }, select: { status: true, depositCents: true, totalCents: true, startsAt: true, endsAt: true, staffId: true, services: { select: { serviceId: true, priceCents: true, durationMinutes: true } } } });
      expect(appointment.status).toBe("CONFIRMED");
      expect(appointment.depositCents).toBe(0);
      expect(appointment.totalCents).toBe(5000);
      expect(appointment.staffId).toBe(fullStaffId);
      expect(appointment.endsAt.getTime() - appointment.startsAt.getTime()).toBe(60 * 60_000);
      expect(appointment.services).toHaveLength(3);
      expect(appointment.services.map((item) => [item.serviceId, item.priceCents, item.durationMinutes])).toEqual(expect.arrayContaining([[services.corte, 3000, 30], [services.barba, 1500, 20], [services.sobrancelha, 500, 10]]));
      expect(await db.appointment.count({ where: { tenantId, customer: { phone: "+32 470 11 22 33" } } })).toBe(1);
      expect(await db.payment.count({ where: { appointmentId: booking.appointmentId } })).toBe(0);
      expect(await db.deposit.count({ where: { appointmentId: booking.appointmentId } })).toBe(0);
    });

    it("rejeita profissional forçado sem habilitação, serviço de outra barbearia e lista repetida", async () => {
      const base = { slug, date, time: "13:00", firstName: "Cliente", lastName: "Teste", phone: "+32 470 44 55 66" };
      await expect(createPublicBooking({ ...base, serviceIds: all(), staffId: partialStaffId })).rejects.toThrow(new BookingError("SLOT_CONFLICT"));
      await expect(createPublicBooking({ ...base, serviceIds: [services.corte, otherServiceId], staffId: "any" })).rejects.toThrow(new BookingError("RESOURCE_NOT_FOUND"));
      await expect(createPublicBooking({ ...base, serviceIds: [services.corte, services.corte], staffId: "any" })).rejects.toThrow(new BookingError("INVALID_SERVICES"));
      await expect(createPublicBooking({ ...base, serviceIds: [], staffId: "any" })).rejects.toThrow(new BookingError("INVALID_SERVICES"));
    });

    it("rejeita dia fora da janela pública (passado ou além de hoje + 60)", async () => {
      const base = { slug, serviceIds: [services.corte], staffId: "any", time: "13:00", firstName: "Cliente", lastName: "Teste", phone: "+32 470 44 55 66" };
      await expect(createPublicBooking({ ...base, date: dateAfter(-1) })).rejects.toThrow(new BookingError("OUTSIDE_WINDOW"));
      await expect(createPublicBooking({ ...base, date: dateAfter(62) })).rejects.toThrow(new BookingError("OUTSIDE_WINDOW"));
    });

    it("duas reservas concorrentes no mesmo horário do mesmo profissional: só uma confirma", async () => {
      const concurrentDate = dateAfter(21);
      const base = { slug, serviceIds: [services.corte, services.barba], staffId: fullStaffId, date: concurrentDate, time: "11:00" };
      const results = await Promise.allSettled([
        createPublicBooking({ ...base, firstName: "Primeiro", lastName: "Cliente", phone: "+32 470 70 00 01" }),
        createPublicBooking({ ...base, firstName: "Segundo", lastName: "Cliente", phone: "+32 470 70 00 02" }),
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toEqual(new BookingError("SLOT_CONFLICT"));

      const startsAt = fulfilled[0]?.status === "fulfilled" ? fulfilled[0].value.startsAt : undefined;
      expect(await tenantDb(tenantId).appointment.count({ where: { tenantId, staffId: fullStaffId, startsAt, status: "CONFIRMED" } })).toBe(1);
    });
  });
});
