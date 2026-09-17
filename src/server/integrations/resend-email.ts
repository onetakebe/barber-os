import { Resend, type CreateEmailOptions, type CreateEmailRequestOptions, type CreateEmailResponse, type ErrorResponse } from "resend";

import { ProviderSendError, type NotificationChannelProvider, type RenderedMessage } from "@/server/notifications/contracts";

/* Transporte de e-mail real (Resend). O SDK não lança em erro de API: devolve `{ data, error }`.
   Aqui a resposta vira sucesso com id do provedor ou `ProviderSendError` classificado, que é
   o que a fila usa para decidir entre retentar e desistir. */

/** Só o que usamos do SDK — permite injetar um cliente falso nos testes. */
export type ResendEmailsClient = { send(payload: CreateEmailOptions, options?: CreateEmailRequestOptions): Promise<CreateEmailResponse> };

/** Erros de idempotência (409) são transitórios: o `after()` da reserva e o endpoint interno
 *  podem esbarrar na mesma chave ao mesmo tempo, e o e-mail em curso não pode virar FAILED. */
const TRANSIENT_ERROR_NAMES: ReadonlySet<ErrorResponse["name"]> = new Set(["concurrent_idempotent_requests", "invalid_idempotent_request", "rate_limit_exceeded", "internal_server_error"]);

/** 429, 5xx e sem status (rede/timeout) valem nova tentativa, além dos nomes acima; o resto
 *  do 4xx é definitivo (chave inválida, remetente não verificado, destinatário malformado…). */
export function classifyResendError(error: ErrorResponse): ProviderSendError {
  const status = error.statusCode;
  const transient = TRANSIENT_ERROR_NAMES.has(error.name) || status === null || status === 429 || status >= 500;
  return new ProviderSendError(transient ? "transient" : "permanent", error.name, `${error.name}: ${error.message}`);
}

export class ResendEmailProvider implements NotificationChannelProvider {
  readonly channel = "EMAIL" as const;
  readonly name = "resend";

  constructor(private readonly emails: ResendEmailsClient, private readonly from: string) {}

  /** Sem `RESEND_API_KEY` e `EMAIL_FROM` não há transporte — e a fila registra isso, em vez de fingir envio. */
  static fromEnv(env: Record<string, string | undefined> = process.env): ResendEmailProvider | null {
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.EMAIL_FROM?.trim();
    if (!apiKey || !from) return null;
    return new ResendEmailProvider(new Resend(apiKey).emails, from);
  }

  async send(recipient: string, rendered: RenderedMessage, idempotencyKey: string) {
    const result = await this.emails.send(
      { from: this.from, to: recipient, subject: rendered.subject, html: rendered.html, text: rendered.text, replyTo: rendered.replyTo },
      { idempotencyKey },
    );
    if (result.error) throw classifyResendError(result.error);
    return { providerMessageId: result.data.id };
  }
}
