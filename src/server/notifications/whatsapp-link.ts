import type { BookingConfirmedV1 } from "@/server/notifications/contracts";
import { renderBookingConfirmedWhatsAppText } from "@/server/notifications/booking-confirmed";

/* "Clique para conversar" do WhatsApp: sem conta, sem custo, sem API. O cliente manda a mensagem
   de confirmação para a barbearia a partir do próprio celular. Não é o canal WHATSAPP da fila
   (esse continua desabilitado até existir transporte real) — é um link na tela de sucesso. */

/** Dígitos no formato que o wa.me aceita (código do país + número, sem "+", "00" nem separadores). */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function buildWhatsAppLink(phone: string | null | undefined, text: string): string | null {
  const number = normalizeWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** Link para o cliente confirmar a reserva com a barbearia; `null` quando ela não tem telefone. */
export function buildBookingConfirmedWhatsAppLink(event: BookingConfirmedV1): string | null {
  return buildWhatsAppLink(event.business.phone, renderBookingConfirmedWhatsAppText(event));
}
