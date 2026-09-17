import { ResendEmailProvider } from "@/server/integrations/resend-email";
import { EMAIL_PROVIDER_NOT_CONFIGURED, WHATSAPP_CHANNEL_DISABLED, type ChannelRegistry } from "@/server/notifications/contracts";

/** Provedor por canal, montado do ambiente. E-mail só existe com `RESEND_API_KEY` + `EMAIL_FROM`.
 *  WhatsApp entra explicitamente desabilitado: o contrato (`BookingConfirmedV1`) já serve, o
 *  transporte ainda não existe (ver docs/notifications.md). */
export function buildChannelRegistry(env: Record<string, string | undefined> = process.env): ChannelRegistry {
  const email = ResendEmailProvider.fromEnv(env);
  return {
    EMAIL: email ? { enabled: true, provider: email } : { enabled: false, reason: EMAIL_PROVIDER_NOT_CONFIGURED },
    WHATSAPP: { enabled: false, reason: WHATSAPP_CHANNEL_DISABLED },
  };
}
