import { bookingConfirmedV1Schema, type BookingConfirmedV1, type RenderedMessage } from "@/server/notifications/contracts";
import type { BookingServiceItem } from "@/server/services/booking-services";

/* Confirmação de reserva por e-mail: do retorno da reserva ao snapshot, e do snapshot ao
   assunto/HTML/texto. Tudo em português, hora local no fuso da barbearia, e o que veio do
   cliente (nome, nome da barbearia…) escapado no HTML. */

export const BOOKING_CONFIRMED_TEMPLATE_KEY = "booking_confirmation_v1";

export const bookingConfirmedEventKey = (appointmentId: string) => `booking:${appointmentId}:confirmed`;

export type BookingConfirmedInput = {
  appointmentId: string;
  tenantId: string;
  customerId: string;
  customer: { firstName: string; lastName: string; email: string };
  business: { name: string; address: string | null; phone: string | null; email: string | null };
  staffName: string;
  services: BookingServiceItem[];
  totalCents: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  cancellationNoticeHours: number;
};

export function buildBookingConfirmedEvent(input: BookingConfirmedInput): BookingConfirmedV1 {
  return {
    type: "booking.confirmed",
    version: 1,
    appointmentId: input.appointmentId,
    tenantId: input.tenantId,
    customerId: input.customerId,
    customer: { name: `${input.customer.firstName} ${input.customer.lastName}`.trim(), email: input.customer.email },
    business: input.business,
    staffName: input.staffName,
    services: input.services.map(({ name, priceCents, durationMinutes }) => ({ name, priceCents, durationMinutes })),
    totalCents: input.totalCents,
    currency: input.currency,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    timezone: input.timezone,
    cancellationNoticeHours: input.cancellationNoticeHours,
  };
}

const money = (cents: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;
/** "terça-feira, 21 de julho de 2026" no fuso da barbearia. */
const longDate = (iso: string, timeZone: string) => new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
const shortDate = (iso: string, timeZone: string) => new Intl.DateTimeFormat("pt-BR", { timeZone, day: "numeric", month: "long" }).format(new Date(iso));
const clock = (iso: string, timeZone: string) => new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/** Frases compartilhadas pelo texto e pelo HTML, para as duas versões dizerem o mesmo. */
function lines(event: BookingConfirmedV1) {
  const tz = event.timezone;
  return {
    greeting: `Olá, ${event.customer.name}.`,
    intro: `Sua reserva na ${event.business.name} está confirmada.`,
    when: `${longDate(event.startsAt, tz)}, das ${clock(event.startsAt, tz)} às ${clock(event.endsAt, tz)}`,
    staff: `Profissional: ${event.staffName}`,
    servicesTitle: `${plural(event.services.length, "serviço", "serviços")} (${plural(event.services.reduce((sum, item) => sum + item.durationMinutes, 0), "minuto", "minutos")})`,
    services: event.services.map((item) => ({ label: `${item.name} · ${item.durationMinutes} min`, price: money(item.priceCents, event.currency) })),
    total: `Total, pago na barbearia: ${money(event.totalCents, event.currency)}`,
    address: event.business.address ? `Endereço: ${event.business.address}` : null,
    phone: event.business.phone ? `Telefone: ${event.business.phone}` : null,
    policy: `Precisa remarcar? Avise com pelo menos ${plural(event.cancellationNoticeHours, "hora", "horas")} de antecedência.`,
    code: `Código da reserva: ${event.appointmentId.slice(0, 8)}`,
  };
}

export function renderBookingConfirmed(event: BookingConfirmedV1): RenderedMessage {
  const l = lines(event);
  const subject = `Reserva confirmada · ${shortDate(event.startsAt, event.timezone)} às ${clock(event.startsAt, event.timezone)} · ${event.business.name}`;

  const text = [
    l.greeting,
    l.intro,
    "",
    l.when,
    l.staff,
    "",
    l.servicesTitle,
    ...l.services.map((item) => `- ${item.label} — ${item.price}`),
    l.total,
    "",
    l.address,
    l.phone,
    "",
    l.policy,
    l.code,
  ].filter((line): line is string => line !== null).join("\n");

  const e = escapeHtml;
  const html = [
    `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">`,
    `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#a16207">Reserva confirmada</p>`,
    `<h1 style="margin:0 0 16px;font-size:22px">${e(event.business.name)}</h1>`,
    `<p style="margin:0 0 4px">${e(l.greeting)}</p><p style="margin:0 0 20px">${e(l.intro)}</p>`,
    `<p style="margin:0;font-size:18px;font-weight:600">${e(l.when)}</p><p style="margin:4px 0 20px;color:#57534e">${e(l.staff)}</p>`,
    `<p style="margin:0 0 6px;font-weight:600">${e(l.servicesTitle)}</p>`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 8px">`,
    ...l.services.map((item) => `<tr><td style="padding:4px 0;border-bottom:1px solid #e7e5e4">${e(item.label)}</td><td style="padding:4px 0;border-bottom:1px solid #e7e5e4;text-align:right">${e(item.price)}</td></tr>`),
    `</table><p style="margin:0 0 20px;font-weight:600">${e(l.total)}</p>`,
    l.address ? `<p style="margin:0 0 4px;color:#57534e">${e(l.address)}</p>` : "",
    l.phone ? `<p style="margin:0 0 20px;color:#57534e">${e(l.phone)}</p>` : "",
    `<p style="margin:0 0 4px;font-size:13px;color:#57534e">${e(l.policy)}</p>`,
    `<p style="margin:0;font-size:13px;color:#57534e">${e(l.code)}</p>`,
    `</div></body></html>`,
  ].join("");

  return { subject, html, text, replyTo: event.business.email ?? undefined };
}

/** Título e corpo em texto puro da linha em `Notification` (central de notificações do painel). */
export function summarizeBookingConfirmed(event: BookingConfirmedV1) {
  const names = event.services.map((item) => item.name).join(" + ");
  return {
    title: "Reserva confirmada",
    body: `${names} com ${event.staffName}, ${longDate(event.startsAt, event.timezone)} às ${clock(event.startsAt, event.timezone)}. ${money(event.totalCents, event.currency)}, pago na barbearia. E-mail para ${event.customer.email}.`,
  };
}

/** Renderiza a partir do `metadata` gravado; `null` se o snapshot não for um V1 válido. */
export function renderBookingConfirmedSnapshot(metadata: unknown): RenderedMessage | null {
  const parsed = bookingConfirmedV1Schema.safeParse(metadata);
  return parsed.success ? renderBookingConfirmed(parsed.data) : null;
}
