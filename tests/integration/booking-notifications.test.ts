import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as dispatchRoute } from "@/app/api/internal/notifications/dispatch/route";
import { adminDb, tenantDb } from "@/server/db";
import { BOOKING_CONFIRMED_TEMPLATE_KEY, bookingConfirmedEventKey } from "@/server/notifications/booking-confirmed";
import { bookingConfirmedV1Schema, EMAIL_PROVIDER_NOT_CONFIGURED, WHATSAPP_CHANNEL_DISABLED, type ChannelRegistry, type NotificationChannelProvider } from "@/server/notifications/contracts";
import { dispatchNotification, dispatchPending } from "@/server/notifications/dispatch";
import { prismaNotificationStore } from "@/server/notifications/store";
import { BookingError } from "@/server/services/booking";
import { createPublicBooking } from "@/server/services/public-booking";

/* Confirmação real por e-mail (Bloco 1 / ticket 3) contra o banco real do .env, em duas
   barbearias temporárias. Nenhum envio real: o provedor é sempre um falso injetado, e sem
   RESEND_API_KEY o registro padrão deixa a linha na fila. */
describe.sequential("notificação de reserva confirmada", () => {
  const stamp = Date.now();
  const slug = `notif-${stamp}`;
  const timezone = "Europe/Brussels";
  let tenantId: string;
  let otherTenantId: string;
  let staffId: string;
  let corteId: string;
  let barbaId: string;
  const dateAfter = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const date = dateAfter(10);
  const secret = `segredo-${stamp}`;

  const fakeRegistry = (send: NotificationChannelProvider["send"]): ChannelRegistry => ({ EMAIL: { enabled: true, provider: { channel: "EMAIL", name: "fake", send } }, WHATSAPP: { enabled: false, reason: WHATSAPP_CHANNEL_DISABLED } });

  beforeAll(async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.NOTIFICATIONS_DISPATCH_SECRET = secret;

    const tenant = await adminDb.tenant.create({ data: { name: "Notif & Cia", slug, email: `notif-${stamp}@exemplo.com`, phone: "+32 2 000 00 00", address: "Rua Alta, 10", timezone }, select: { id: true } });
    tenantId = tenant.id;
    const db = tenantDb(tenantId);
    const category = await db.serviceCategory.create({ data: { tenantId, name: "Cortes" }, select: { id: true } });
    corteId = (await db.service.create({ data: { tenantId, categoryId: category.id, name: "Corte", priceCents: 3000, durationMinutes: 30 }, select: { id: true } })).id;
    barbaId = (await db.service.create({ data: { tenantId, categoryId: category.id, name: "Barba", priceCents: 1500, durationMinutes: 20 }, select: { id: true } })).id;
    staffId = (await db.staff.create({ data: { tenantId, displayName: "Marcos" }, select: { id: true } })).id;
    await db.staffService.createMany({ data: [corteId, barbaId].map((serviceId) => ({ tenantId, staffId, serviceId })) });
    await db.availability.createMany({ data: Array.from({ length: 7 }, (_, dayOfWeek) => ({ tenantId, staffId, dayOfWeek, startMinute: 540, endMinute: 1020 })) });

    otherTenantId = (await adminDb.tenant.create({ data: { name: "Outra", slug: `outra-notif-${stamp}`, email: `outra-notif-${stamp}@exemplo.com` }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await adminDb.appointment.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await adminDb.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
  });

  const book = (overrides: Partial<Parameters<typeof createPublicBooking>[0]> = {}) =>
    createPublicBooking({ slug, serviceIds: [corteId, barbaId], staffId: "any", date, time: "10:00", firstName: "Ana", lastName: "Silva", email: "ana@exemplo.com", phone: `+32 470 ${stamp % 1_000_000}`, ...overrides });

  it("a reserva grava uma única notificação QUEUED cujo snapshot é o agendamento persistido", async () => {
    const booking = await book();
    expect(booking.notificationId).toBeTruthy();

    const db = tenantDb(tenantId);
    const rows = await db.notification.findMany({ where: { tenantId, customerId: booking.customerId } });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row).toMatchObject({ id: booking.notificationId, channel: "EMAIL", status: "QUEUED", recipient: "ana@exemplo.com", templateKey: BOOKING_CONFIRMED_TEMPLATE_KEY, eventKey: bookingConfirmedEventKey(booking.appointmentId), attempts: 0, sentAt: null, provider: null, providerMessageId: null, lastError: null });
    expect(row.title).toBe("Reserva confirmada");
    expect(row.body).toContain("Corte + Barba");
    expect(row.body).not.toContain("simulado");

    const event = bookingConfirmedV1Schema.parse(row.metadata);
    const appointment = await db.appointment.findUniqueOrThrow({ where: { id: booking.appointmentId }, select: { totalCents: true, startsAt: true, endsAt: true, customerId: true, staff: { select: { displayName: true } }, services: { select: { priceCents: true, durationMinutes: true, service: { select: { name: true } } } } } });
    expect(event).toMatchObject({ type: "booking.confirmed", version: 1, appointmentId: booking.appointmentId, tenantId, customerId: appointment.customerId, staffName: appointment.staff.displayName, totalCents: appointment.totalCents, currency: "EUR", startsAt: appointment.startsAt.toISOString(), endsAt: appointment.endsAt.toISOString(), timezone, cancellationNoticeHours: 24 });
    expect(event.services).toEqual(appointment.services.map((item) => ({ name: item.service.name, priceCents: item.priceCents, durationMinutes: item.durationMinutes })));
    expect(event.customer).toEqual({ name: "Ana Silva", email: "ana@exemplo.com" });
    expect(event.business).toEqual({ name: "Notif & Cia", address: "Rua Alta, 10", phone: "+32 2 000 00 00", email: `notif-${stamp}@exemplo.com` });
  });

  it("a reserva que falha (conflito de horário) não deixa notificação", async () => {
    // Mesmo horário e profissional do teste anterior: a exclusion constraint derruba a transação.
    await expect(book({ staffId, phone: "+32 470 11 11 11", email: "perdeu@exemplo.com" })).rejects.toThrow(new BookingError("SLOT_CONFLICT"));
    expect(await tenantDb(tenantId).notification.count({ where: { tenantId, recipient: "perdeu@exemplo.com" } })).toBe(0);
    expect(await tenantDb(tenantId).customer.count({ where: { tenantId, phone: "+32 470 11 11 11" } })).toBe(0);
  });

  it("sem RESEND_API_KEY fica QUEUED com o motivo, sem gastar tentativa; a reserva segue confirmada", async () => {
    const booking = await book({ time: "13:00", phone: "+32 470 22 22 22" });
    await expect(dispatchNotification(booking.notificationId, { store: prismaNotificationStore(tenantDb(tenantId)) })).resolves.toBe("NOT_CONFIGURED");
    const row = await tenantDb(tenantId).notification.findUniqueOrThrow({ where: { id: booking.notificationId } });
    expect(row).toMatchObject({ status: "QUEUED", attempts: 0, nextAttemptAt: null, lastError: EMAIL_PROVIDER_NOT_CONFIGURED });
    expect((await tenantDb(tenantId).appointment.findUniqueOrThrow({ where: { id: booking.appointmentId } })).status).toBe("CONFIRMED");
  });

  it("uma barbearia não lê nem processa a notificação de outra", async () => {
    const booking = await book({ time: "14:00", phone: "+32 470 33 33 33" });
    const foreign = tenantDb(otherTenantId);
    expect(await foreign.notification.findUnique({ where: { id: booking.notificationId } })).toBeNull();
    const send = vi.fn(async () => ({ providerMessageId: "never" }));
    await expect(dispatchNotification(booking.notificationId, { store: prismaNotificationStore(foreign), providers: fakeRegistry(send) })).resolves.toBe("NOT_FOUND");
    expect(await dispatchPending({ limit: 50, store: prismaNotificationStore(foreign), providers: fakeRegistry(send) })).toMatchObject({ processed: 0 });
    expect(send).not.toHaveBeenCalled();
    expect((await tenantDb(tenantId).notification.findUniqueOrThrow({ where: { id: booking.notificationId } })).status).toBe("QUEUED");
  });

  it("dispatchPending com provedor falso marca SENT e guarda o id do provedor; o WhatsApp não é chamado", async () => {
    const booking = await book({ time: "15:00", phone: "+32 470 44 44 44" });
    // Linha de WhatsApp na fila (o contrato já serve para o canal, o transporte não existe).
    const whatsapp = await tenantDb(tenantId).notification.create({ data: { tenantId, customerId: booking.customerId, channel: "WHATSAPP", status: "QUEUED", recipient: "+32470444444", templateKey: BOOKING_CONFIRMED_TEMPLATE_KEY, eventKey: bookingConfirmedEventKey(booking.appointmentId), title: "Reserva confirmada", body: "-", metadata: {} }, select: { id: true } });
    const send = vi.fn(async (_recipient: string, _rendered: unknown, idempotencyKey: string) => ({ providerMessageId: `email_${idempotencyKey}` }));

    // Fila só desta barbearia: os e-mails das reservas acima e a linha de WhatsApp.
    const store = prismaNotificationStore(tenantDb(tenantId));
    const pendingEmails = await tenantDb(tenantId).notification.count({ where: { tenantId, status: "QUEUED", channel: "EMAIL", eventKey: { not: null } } });
    expect(pendingEmails).toBeGreaterThanOrEqual(1);
    const summary = await dispatchPending({ limit: 50, store, providers: fakeRegistry(send) });
    expect(summary).toEqual({ processed: pendingEmails + 1, sent: pendingEmails, retried: 0, failed: 0, notConfigured: 1, skipped: 0 });
    expect(send).toHaveBeenCalledTimes(pendingEmails);
    expect(send.mock.calls.every(([recipient]) => recipient.includes("@"))).toBe(true);

    const sent = await tenantDb(tenantId).notification.findUniqueOrThrow({ where: { id: booking.notificationId } });
    expect(sent).toMatchObject({ status: "SENT", provider: "fake", providerMessageId: `email_${bookingConfirmedEventKey(booking.appointmentId)}`, attempts: 1, lastError: null });
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect(await tenantDb(tenantId).notification.findUniqueOrThrow({ where: { id: whatsapp.id } })).toMatchObject({ status: "QUEUED", attempts: 0, lastError: WHATSAPP_CHANNEL_DISABLED });
    // Segunda passada não reenvia o que já foi.
    const again = await dispatchPending({ limit: 50, store, providers: fakeRegistry(send) });
    expect(again).toMatchObject({ sent: 0, notConfigured: 1 });
    expect(send).toHaveBeenCalledTimes(pendingEmails);
  });

  it("endpoint interno: 401 sem ou com bearer errado; com o certo processa pendentes", async () => {
    const call = (headers: Record<string, string>, body?: unknown) => dispatchRoute(new Request("http://localhost/api/internal/notifications/dispatch", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }));
    expect((await call({})).status).toBe(401);
    expect((await call({ authorization: `Bearer errado-${stamp}` })).status).toBe(401);
    expect((await call({ authorization: `Bearer ${secret}` }, { limit: 0 })).status).toBe(400);

    // O endpoint atravessa o banco inteiro: aqui só a forma da resposta. Sem provedor
    // configurado nada é enviado nem falha.
    const response = await call({ authorization: `Bearer ${secret}` }, { limit: 50 });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ sent: 0, retried: 0, failed: 0 });
    expect(Object.keys(payload).sort()).toEqual(["failed", "notConfigured", "processed", "retried", "sent", "skipped"]);
    expect(payload.processed).toBe(payload.notConfigured + payload.skipped);

    // O efeito numa linha, com o mesmo registro padrão (sem chave) e o alcance desta barbearia.
    const booking = await book({ time: "16:00", phone: "+32 470 55 55 55" });
    await expect(dispatchNotification(booking.notificationId, { store: prismaNotificationStore(tenantDb(tenantId)) })).resolves.toBe("NOT_CONFIGURED");
    const row = await tenantDb(tenantId).notification.findUniqueOrThrow({ where: { id: booking.notificationId } });
    expect(row).toMatchObject({ status: "QUEUED", attempts: 0, lastError: EMAIL_PROVIDER_NOT_CONFIGURED });
  });
});
