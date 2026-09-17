import { z } from "zod";

import type { NotificationChannel } from "@/generated/prisma/client";

/* Contratos da fila de notificações (Bloco 1 / ticket 3).
   O evento é o snapshot versionado que a reserva grava em `Notification.metadata`; cada canal
   renderiza a partir dele, sem voltar ao banco. Versão nova de evento = tipo novo (V2), nunca
   mudança silenciosa do V1: linhas antigas continuam legíveis. */

export const bookingConfirmedV1Schema = z.object({
  type: z.literal("booking.confirmed"),
  version: z.literal(1),
  appointmentId: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  customer: z.object({ name: z.string(), email: z.string() }),
  business: z.object({ name: z.string(), address: z.string().nullable(), phone: z.string().nullable(), email: z.string().nullable() }),
  /** Nome do profissional efetivamente atribuído, mesmo quando o cliente pediu "qualquer". */
  staffName: z.string(),
  services: z.array(z.object({ name: z.string(), priceCents: z.number().int(), durationMinutes: z.number().int() })).min(1),
  totalCents: z.number().int(),
  currency: z.string(),
  /** Instantes em UTC (ISO); a hora local sai do `timezone` na hora de renderizar. */
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timezone: z.string(),
  cancellationNoticeHours: z.number().int(),
});

export type BookingConfirmedV1 = z.infer<typeof bookingConfirmedV1Schema>;

export type RenderedMessage = {
  subject: string;
  html: string;
  text: string;
  /** Resposta do cliente vai para a barbearia, não para o remetente técnico. */
  replyTo?: string;
};

/** Erro de envio classificado pelo provedor: transitório entra na retentativa, permanente não. */
export class ProviderSendError extends Error {
  constructor(readonly kind: "transient" | "permanent", readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "ProviderSendError";
  }
}

export interface NotificationChannelProvider {
  readonly channel: NotificationChannel;
  readonly name: string;
  /** `idempotencyKey` = `eventKey`: reenviar a mesma linha nunca duplica a mensagem no provedor. */
  send(recipient: string, rendered: RenderedMessage, idempotencyKey: string): Promise<{ providerMessageId: string }>;
}

export type ChannelRegistryEntry =
  | { enabled: true; provider: NotificationChannelProvider }
  /** Canal conhecido mas sem transporte: a linha fica na fila, sem chamada externa e sem sucesso fingido. */
  | { enabled: false; reason: string };

export type ChannelRegistry = Partial<Record<NotificationChannel, ChannelRegistryEntry>>;

export const EMAIL_PROVIDER_NOT_CONFIGURED = "EMAIL_PROVIDER_NOT_CONFIGURED";
export const WHATSAPP_CHANNEL_DISABLED = "WHATSAPP_CHANNEL_DISABLED";
