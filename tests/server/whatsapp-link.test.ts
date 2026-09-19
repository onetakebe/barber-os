import { describe, expect, it } from "vitest";

import { buildBookingConfirmedWhatsAppLink, buildWhatsAppLink, normalizeWhatsAppNumber } from "@/server/notifications/whatsapp-link";
import type { BookingConfirmedV1 } from "@/server/notifications/contracts";

const event: BookingConfirmedV1 = {
  type: "booking.confirmed",
  version: 1,
  appointmentId: "cmfabc123xyz",
  tenantId: "t1",
  customerId: "c1",
  customer: { name: "Ana <Silva>", email: "ana@exemplo.com" },
  business: { name: "AS Barber Club", address: "Rue Antoine Dansaert 74", phone: "+32 2 555 01 84", email: null },
  staffName: "Lucas",
  services: [{ name: "Corte", priceCents: 3000, durationMinutes: 30 }, { name: "Barba", priceCents: 1500, durationMinutes: 20 }],
  totalCents: 4500,
  currency: "EUR",
  startsAt: "2026-07-21T08:00:00.000Z",
  endsAt: "2026-07-21T08:50:00.000Z",
  timezone: "Europe/Brussels",
  cancellationNoticeHours: 24,
};

describe("link de WhatsApp da tela de sucesso", () => {
  it("normaliza o número para o formato do wa.me", () => {
    expect(normalizeWhatsAppNumber("+32 2 555 01 84")).toBe("3225550184");
    expect(normalizeWhatsAppNumber("0032 (2) 555-01-84")).toBe("3225550184");
    expect(normalizeWhatsAppNumber("+55 11 91234-5678")).toBe("5511912345678");
    expect(normalizeWhatsAppNumber("")).toBeNull();
    expect(normalizeWhatsAppNumber(null)).toBeNull();
    expect(normalizeWhatsAppNumber("123")).toBeNull();
  });

  it("monta a URL com o texto codificado", () => {
    expect(buildWhatsAppLink("+32 2 555 01 84", "Olá & até já")).toBe("https://wa.me/3225550184?text=Ol%C3%A1%20%26%20at%C3%A9%20j%C3%A1");
    expect(buildWhatsAppLink(null, "x")).toBeNull();
  });

  it("a mensagem da reserva traz serviços, profissional, hora local, código e nome do cliente", () => {
    const url = buildBookingConfirmedWhatsAppLink(event);
    expect(url).toMatch(/^https:\/\/wa\.me\/3225550184\?text=/);
    const text = decodeURIComponent(url!.split("text=")[1]!);
    expect(text).toContain("AS Barber Club");
    expect(text).toContain("Corte + Barba com Lucas");
    expect(text).toContain("terça-feira, 21 de julho de 2026, às 10:00");
    expect(text).toContain("Código: cmfabc12");
    expect(text).toContain("— Ana <Silva>");
    expect(text).not.toContain("ana@exemplo.com");
  });

  it("sem telefone da barbearia não há link", () => {
    expect(buildBookingConfirmedWhatsAppLink({ ...event, business: { ...event.business, phone: null } })).toBeNull();
  });
});
