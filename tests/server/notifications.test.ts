import { describe, expect, it, vi } from "vitest";

import { classifyResendError, ResendEmailProvider } from "@/server/integrations/resend-email";
import { BOOKING_CONFIRMED_TEMPLATE_KEY, bookingConfirmedEventKey, buildBookingConfirmedEvent, renderBookingConfirmed, summarizeBookingConfirmed } from "@/server/notifications/booking-confirmed";
import { EMAIL_PROVIDER_NOT_CONFIGURED, ProviderSendError, WHATSAPP_CHANNEL_DISABLED, type BookingConfirmedV1, type ChannelRegistry, type NotificationChannelProvider } from "@/server/notifications/contracts";
import { BACKOFF_MINUTES, dispatchNotification, dispatchPending, MAX_ATTEMPTS } from "@/server/notifications/dispatch";
import { buildChannelRegistry } from "@/server/notifications/registry";
import type { NotificationStore, QueuedNotification, TransitionData } from "@/server/notifications/store";

/* Confirmação real por e-mail (Bloco 1 / ticket 3): renderização a partir do snapshot e a
   máquina de estados da fila, com provedor e armazenamento falsos — nenhum envio real. */

const event: BookingConfirmedV1 = {
  type: "booking.confirmed",
  version: 1,
  appointmentId: "appt-1",
  tenantId: "tenant-1",
  customerId: "customer-1",
  customer: { name: "Ana <b>Silva</b>", email: "ana@exemplo.com" },
  business: { name: "Barbearia & Cia", address: "Rua Alta, 10", phone: "+32 2 123 45 67", email: "contato@barbearia.be" },
  staffName: "Marcos",
  services: [{ name: "Corte", priceCents: 3000, durationMinutes: 30 }, { name: "Barba", priceCents: 1500, durationMinutes: 20 }],
  totalCents: 4500,
  currency: "EUR",
  // 08:00Z em julho = 10:00 em Bruxelas (CEST).
  startsAt: "2026-07-21T08:00:00.000Z",
  endsAt: "2026-07-21T08:50:00.000Z",
  timezone: "Europe/Brussels",
  cancellationNoticeHours: 24,
};

describe("evento BookingConfirmedV1", () => {
  it("monta o snapshot a partir do retorno da reserva, com instantes em UTC", () => {
    const built = buildBookingConfirmedEvent({
      appointmentId: "appt-1",
      tenantId: "tenant-1",
      customerId: "customer-1",
      customer: { firstName: "Ana", lastName: "Silva", email: "ana@exemplo.com" },
      business: { name: "Barbearia & Cia", address: null, phone: null, email: null },
      staffName: "Marcos",
      services: [{ id: "s1", name: "Corte", priceCents: 3000, durationMinutes: 30 }],
      totalCents: 3000,
      currency: "EUR",
      startsAt: new Date("2026-07-21T08:00:00.000Z"),
      endsAt: new Date("2026-07-21T08:30:00.000Z"),
      timezone: "Europe/Brussels",
      cancellationNoticeHours: 24,
    });
    expect(built).toMatchObject({ type: "booking.confirmed", version: 1, customer: { name: "Ana Silva" }, startsAt: "2026-07-21T08:00:00.000Z", endsAt: "2026-07-21T08:30:00.000Z" });
    // Só nome/preço/duração: o id do serviço não faz parte do que o cliente vê.
    expect(built.services).toEqual([{ name: "Corte", priceCents: 3000, durationMinutes: 30 }]);
    expect(bookingConfirmedEventKey("appt-1")).toBe("booking:appt-1:confirmed");
    expect(BOOKING_CONFIRMED_TEMPLATE_KEY).toBe("booking_confirmation_v1");
  });
});

describe("renderização da confirmação", () => {
  const rendered = renderBookingConfirmed(event);

  it("formata a hora local no fuso da barbearia, em português", () => {
    expect(rendered.subject).toContain("21 de julho");
    expect(rendered.text).toContain("10:00");
    expect(rendered.text).toContain("10:50");
    expect(rendered.text).not.toContain("08:00");
    expect(rendered.text).toContain("terça-feira");
  });

  it("escapa o que veio do usuário no HTML e mantém o texto puro", () => {
    expect(rendered.html).toContain("Ana &lt;b&gt;Silva&lt;/b&gt;");
    expect(rendered.html).not.toContain("<b>Silva</b>");
    expect(rendered.html).toContain("Barbearia &amp; Cia");
    expect(rendered.text).toContain("Ana <b>Silva</b>");
    expect(rendered.text).toContain("Barbearia & Cia");
  });

  it("lista os serviços com preço e total, e responde para a barbearia", () => {
    expect(rendered.text).toContain("Corte");
    expect(rendered.text).toContain("Barba");
    expect(rendered.text).toMatch(/45,00/);
    expect(rendered.text).toContain("Marcos");
    expect(rendered.text).toContain("Rua Alta, 10");
    expect(rendered.replyTo).toBe("contato@barbearia.be");
  });

  it("concorda plural e singular", () => {
    expect(rendered.text).toContain("2 serviços");
    expect(rendered.text).toContain("24 horas");
    const single = renderBookingConfirmed({ ...event, services: [event.services[0]!], totalCents: 3000, cancellationNoticeHours: 1 });
    expect(single.text).toContain("1 serviço ");
    expect(single.text).toContain("1 hora ");
    expect(single.replyTo).toBe("contato@barbearia.be");
    expect(renderBookingConfirmed({ ...event, business: { ...event.business, email: null } }).replyTo).toBeUndefined();
  });

  it("resume em título e corpo de texto puro para a central de notificações", () => {
    const summary = summarizeBookingConfirmed(event);
    expect(summary.title).toBe("Reserva confirmada");
    expect(summary.body).toContain("Corte + Barba");
    expect(summary.body).toContain("Marcos");
    expect(summary.body).toContain("10:00");
    expect(summary.body).not.toContain("simulado");
  });
});

describe("registro de canais", () => {
  it("sem RESEND_API_KEY o e-mail fica desabilitado, e o WhatsApp sempre", () => {
    const registry = buildChannelRegistry({});
    expect(registry.EMAIL).toEqual({ enabled: false, reason: EMAIL_PROVIDER_NOT_CONFIGURED });
    expect(registry.WHATSAPP).toEqual({ enabled: false, reason: WHATSAPP_CHANNEL_DISABLED });
    expect(buildChannelRegistry({ RESEND_API_KEY: "re_x" }).EMAIL).toEqual({ enabled: false, reason: EMAIL_PROVIDER_NOT_CONFIGURED });
  });

  it("com chave e remetente o e-mail usa o Resend", () => {
    const registry = buildChannelRegistry({ RESEND_API_KEY: "re_x", EMAIL_FROM: "Barber <reservas@exemplo.com>" });
    expect(registry.EMAIL?.enabled).toBe(true);
    expect(registry.EMAIL?.enabled && registry.EMAIL.provider).toBeInstanceOf(ResendEmailProvider);
    expect(registry.WHATSAPP).toEqual({ enabled: false, reason: WHATSAPP_CHANNEL_DISABLED });
  });
});

describe("provedor Resend", () => {
  it("manda com chave de idempotência e devolve o id do provedor", async () => {
    const send = vi.fn(async () => ({ data: { id: "email_123" }, error: null, headers: null }));
    const provider = new ResendEmailProvider({ send }, "Barber <reservas@exemplo.com>");
    const rendered = { subject: "Assunto", html: "<p>Oi</p>", text: "Oi", replyTo: "contato@barbearia.be" };
    await expect(provider.send("ana@exemplo.com", rendered, "booking:appt-1:confirmed")).resolves.toEqual({ providerMessageId: "email_123" });
    expect(send).toHaveBeenCalledWith({ from: "Barber <reservas@exemplo.com>", to: "ana@exemplo.com", subject: "Assunto", html: "<p>Oi</p>", text: "Oi", replyTo: "contato@barbearia.be" }, { idempotencyKey: "booking:appt-1:confirmed" });
  });

  it("classifica 429/5xx/rede como transitório e o resto do 4xx como permanente", async () => {
    expect(classifyResendError({ name: "rate_limit_exceeded", statusCode: 429, message: "" }).kind).toBe("transient");
    expect(classifyResendError({ name: "internal_server_error", statusCode: 500, message: "" }).kind).toBe("transient");
    expect(classifyResendError({ name: "application_error", statusCode: null, message: "fetch failed" }).kind).toBe("transient");
    // 409 de idempotência: outra execução está com a mesma chave — retentar, nunca desistir.
    expect(classifyResendError({ name: "concurrent_idempotent_requests", statusCode: 409, message: "" }).kind).toBe("transient");
    expect(classifyResendError({ name: "invalid_idempotent_request", statusCode: 409, message: "" }).kind).toBe("transient");
    expect(classifyResendError({ name: "invalid_api_key", statusCode: 401, message: "" }).kind).toBe("permanent");
    expect(classifyResendError({ name: "validation_error", statusCode: 422, message: "" }).kind).toBe("permanent");
    const send = vi.fn(async () => ({ data: null, error: { name: "invalid_from_address" as const, statusCode: 403, message: "not verified" }, headers: null }));
    const provider = new ResendEmailProvider({ send }, "reservas@exemplo.com");
    await expect(provider.send("ana@exemplo.com", { subject: "", html: "", text: "" }, "k")).rejects.toMatchObject({ kind: "permanent", code: "invalid_from_address" });
  });
});

/* Armazenamento em memória com a mesma regra da versão Prisma: a transição só vale se a
   linha ainda estiver QUEUED com o número de tentativas esperado. */
type Row = QueuedNotification & TransitionData;

function memoryStore(rows: Row[]) {
  const updates: Array<{ id: string; data: TransitionData }> = [];
  const store: NotificationStore = {
    async find(id) { return rows.find((row) => row.id === id) ?? null; },
    async listPending(now, limit) {
      return rows.filter((row) => row.status === "QUEUED" && row.eventKey !== null && (row.nextAttemptAt === null || row.nextAttemptAt <= now)).slice(0, limit);
    },
    async transition(id, expected, data) {
      const row = rows.find((item) => item.id === id);
      if (!row || row.status !== "QUEUED" || row.attempts !== expected.attempts) return false;
      Object.assign(row, data);
      updates.push({ id, data });
      return true;
    },
  };
  return { store, rows, updates };
}

function queuedRow(overrides: Partial<Row> = {}): Row {
  return { id: "n1", tenantId: "tenant-1", channel: "EMAIL", status: "QUEUED", recipient: "ana@exemplo.com", templateKey: BOOKING_CONFIRMED_TEMPLATE_KEY, eventKey: "booking:appt-1:confirmed", metadata: event, attempts: 0, nextAttemptAt: null, ...overrides };
}

function fakeProvider(send: NotificationChannelProvider["send"]): NotificationChannelProvider {
  return { channel: "EMAIL", name: "fake", send };
}

const enabled = (provider: NotificationChannelProvider): ChannelRegistry => ({ EMAIL: { enabled: true, provider }, WHATSAPP: { enabled: false, reason: WHATSAPP_CHANNEL_DISABLED } });
const now = new Date("2026-07-01T12:00:00.000Z");

describe("máquina de estados da fila", () => {
  it("sucesso: SENT com provedor, id e sentAt; a chave de idempotência é o eventKey", async () => {
    const { store, rows } = memoryStore([queuedRow()]);
    const send = vi.fn<NotificationChannelProvider["send"]>(async () => ({ providerMessageId: "email_123" }));
    await expect(dispatchNotification("n1", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("SENT");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBe("ana@exemplo.com");
    expect(send.mock.calls[0]?.[2]).toBe("booking:appt-1:confirmed");
    expect(rows[0]).toMatchObject({ status: "SENT", provider: "fake", providerMessageId: "email_123", sentAt: now, lastError: null, attempts: 1 });
  });

  it("perdeu a corrida: a outra execução já transitou a linha, nada é gravado e o resultado é STALE", async () => {
    const { store, rows, updates } = memoryStore([queuedRow()]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // O provedor devolve sucesso, mas entre a leitura e a transição outro executor já marcou SENT.
    const send = vi.fn<NotificationChannelProvider["send"]>(async () => {
      Object.assign(rows[0]!, { status: "SENT", attempts: 1, providerMessageId: "email_do_outro" });
      return { providerMessageId: "email_meu" };
    });
    await expect(dispatchNotification("n1", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("STALE");
    expect(rows[0]).toMatchObject({ status: "SENT", attempts: 1, providerMessageId: "email_do_outro" });
    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("NOTIFICATION_TRANSITION_LOST", { notificationId: "n1", expectedAttempts: 0, outcome: "SENT" });
    warn.mockRestore();
  });

  it("falha transitória: attempts+1, nextAttemptAt no futuro com backoff progressivo, ainda QUEUED", async () => {
    const { store, rows } = memoryStore([queuedRow()]);
    const provider = fakeProvider(async () => { throw new ProviderSendError("transient", "rate_limit_exceeded"); });
    for (const [index, minutes] of BACKOFF_MINUTES.entries()) {
      rows[0]!.nextAttemptAt = null;
      await expect(dispatchNotification("n1", { store, providers: enabled(provider), now })).resolves.toBe("RETRY");
      const updated = await store.find("n1");
      expect(updated).toMatchObject({ status: "QUEUED", attempts: index + 1, lastError: "rate_limit_exceeded" });
      expect(updated?.nextAttemptAt?.getTime()).toBe(now.getTime() + minutes * 60_000);
    }
    // Quinta falha esgota as tentativas.
    await expect(dispatchNotification("n1", { store, providers: enabled(provider), now })).resolves.toBe("FAILED");
    expect(rows[0]).toMatchObject({ status: "FAILED", attempts: MAX_ATTEMPTS, nextAttemptAt: null });
  });

  it("erro desconhecido do provedor conta como transitório", async () => {
    const { store, rows } = memoryStore([queuedRow()]);
    const provider = fakeProvider(async () => { throw new Error("socket hang up"); });
    await expect(dispatchNotification("n1", { store, providers: enabled(provider), now })).resolves.toBe("RETRY");
    expect(rows[0]).toMatchObject({ status: "QUEUED", attempts: 1, lastError: "socket hang up" });
  });

  it("falha permanente: FAILED de imediato, sem retentativa", async () => {
    const { store, rows } = memoryStore([queuedRow()]);
    const provider = fakeProvider(async () => { throw new ProviderSendError("permanent", "invalid_from_address", "invalid_from_address: not verified"); });
    await expect(dispatchNotification("n1", { store, providers: enabled(provider), now })).resolves.toBe("FAILED");
    expect(rows[0]).toMatchObject({ status: "FAILED", attempts: 1, nextAttemptAt: null, lastError: "invalid_from_address: not verified" });
  });

  it("provedor não configurado: fica QUEUED com o motivo, sem consumir tentativa", async () => {
    const { store, rows } = memoryStore([queuedRow()]);
    await expect(dispatchNotification("n1", { store, providers: buildChannelRegistry({}), now })).resolves.toBe("NOT_CONFIGURED");
    expect(rows[0]).toMatchObject({ status: "QUEUED", attempts: 0, nextAttemptAt: null, lastError: EMAIL_PROVIDER_NOT_CONFIGURED });
  });

  it("WhatsApp desabilitado: zero chamadas, linha fica QUEUED com o motivo", async () => {
    const { store, rows } = memoryStore([queuedRow({ id: "w1", channel: "WHATSAPP", recipient: "+32470000000", eventKey: "booking:appt-1:confirmed" })]);
    const send = vi.fn(async () => ({ providerMessageId: "never" }));
    await expect(dispatchNotification("w1", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("NOT_CONFIGURED");
    expect(send).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ status: "QUEUED", attempts: 0, lastError: WHATSAPP_CHANNEL_DISABLED });
  });

  it("snapshot inválido ou template desconhecido: FAILED sem chamar o provedor", async () => {
    const { store, rows } = memoryStore([queuedRow({ id: "bad", metadata: { simulated: true } }), queuedRow({ id: "tpl", templateKey: "outro_template" })]);
    const send = vi.fn(async () => ({ providerMessageId: "never" }));
    await expect(dispatchNotification("bad", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("FAILED");
    await expect(dispatchNotification("tpl", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("FAILED");
    expect(send).not.toHaveBeenCalled();
    expect(rows.map((row) => row.lastError)).toEqual(["INVALID_EVENT_SNAPSHOT", "UNKNOWN_TEMPLATE"]);
  });

  it("retentativa ainda no prazo de backoff é ignorada mesmo se foi listada antes", async () => {
    // Passagem 1 falhou e agendou nextAttemptAt; passagem 2 já tinha listado a linha vencida.
    const { store } = memoryStore([{ ...queuedRow(), attempts: 1, nextAttemptAt: new Date(now.getTime() + 60_000) }]);
    const send = vi.fn(async () => ({ providerMessageId: "x" }));
    await expect(dispatchNotification("n1", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("SKIPPED");
    expect(send).not.toHaveBeenCalled();
    expect((await store.find("n1"))?.attempts).toBe(1);
  });

  it("linha já enviada, legada (sem eventKey) ou inexistente é ignorada", async () => {
    const { store, updates } = memoryStore([queuedRow({ id: "sent", status: "SENT" }), queuedRow({ id: "legacy", eventKey: null, templateKey: null, metadata: { simulated: true } })]);
    const send = vi.fn(async () => ({ providerMessageId: "never" }));
    await expect(dispatchNotification("sent", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("SKIPPED");
    await expect(dispatchNotification("legacy", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("SKIPPED");
    await expect(dispatchNotification("nope", { store, providers: enabled(fakeProvider(send)), now })).resolves.toBe("NOT_FOUND");
    expect(send).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("dispatchPending processa só o que venceu, respeita o limite e devolve contagens", async () => {
    const future = new Date(now.getTime() + 60_000);
    const { store } = memoryStore([
      queuedRow({ id: "a", eventKey: "booking:a:confirmed" }),
      queuedRow({ id: "b", eventKey: "booking:b:confirmed", nextAttemptAt: future }),
      queuedRow({ id: "c", eventKey: "booking:c:confirmed", recipient: "quebra@exemplo.com" }),
      queuedRow({ id: "d", eventKey: "booking:d:confirmed" }),
      queuedRow({ id: "legacy", eventKey: null }),
    ]);
    const send = vi.fn<NotificationChannelProvider["send"]>(async (recipient) => { if (recipient.startsWith("quebra")) throw new ProviderSendError("permanent", "validation_error"); return { providerMessageId: `id_${recipient}` }; });
    const summary = await dispatchPending({ limit: 3, store, providers: enabled(fakeProvider(send)), now });
    expect(summary).toEqual({ processed: 3, sent: 2, retried: 0, failed: 1, notConfigured: 0, skipped: 0 });
    expect(send).toHaveBeenCalledTimes(3);
  });
});
