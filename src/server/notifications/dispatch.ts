import { BOOKING_CONFIRMED_TEMPLATE_KEY, renderBookingConfirmedSnapshot } from "@/server/notifications/booking-confirmed";
import { ProviderSendError, type ChannelRegistry, type RenderedMessage } from "@/server/notifications/contracts";
import { buildChannelRegistry } from "@/server/notifications/registry";
import type { NotificationStore, QueuedNotification, TransitionData } from "@/server/notifications/store";

/* Envio das notificações enfileiradas (Bloco 1 / ticket 3), versão enxuta: sem webhook, sem
   cron, sem lock. A reserva chama `dispatchNotification` depois do commit; o endpoint interno
   chama `dispatchPending` para o que ficou para trás. Estados: QUEUED → SENT | FAILED. */

/** Espera antes da próxima tentativa, por número de falhas já acumuladas. */
export const BACKOFF_MINUTES = [1, 5, 15, 60] as const;
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

/** `STALE`: outra execução mexeu na linha entre a leitura e a transição — nada foi gravado. */
export type DispatchOutcome = "SENT" | "RETRY" | "FAILED" | "NOT_CONFIGURED" | "SKIPPED" | "NOT_FOUND" | "STALE";

export type DispatchOptions = {
  /** Quem chama escolhe o alcance: `tenantDb` na reserva, `adminDb` no endpoint interno. */
  store: NotificationStore;
  /** Provedores por canal (padrão: registro montado do ambiente). Testes injetam um falso. */
  providers?: ChannelRegistry;
  now?: Date;
};

const renderers: Record<string, (metadata: unknown) => RenderedMessage | null> = {
  [BOOKING_CONFIRMED_TEMPLATE_KEY]: renderBookingConfirmedSnapshot,
};

function render(row: QueuedNotification): RenderedMessage | { error: "UNKNOWN_TEMPLATE" | "INVALID_EVENT_SNAPSHOT" } {
  const renderer = row.templateKey ? renderers[row.templateKey] : undefined;
  if (!renderer) return { error: "UNKNOWN_TEMPLATE" };
  return renderer(row.metadata) ?? { error: "INVALID_EVENT_SNAPSHOT" };
}

export async function dispatchNotification(notificationId: string, options: DispatchOptions): Promise<DispatchOutcome> {
  const { store } = options;
  const providers = options.providers ?? buildChannelRegistry();
  const now = options.now ?? new Date();

  const row = await store.find(notificationId);
  if (!row) return "NOT_FOUND";
  if (row.status !== "QUEUED" || !row.eventKey || !row.recipient) return "SKIPPED";
  // Revalida o prazo na linha relida: duas passagens sobrepostas não podem queimar o backoff.
  if (row.nextAttemptAt && row.nextAttemptAt > now) return "SKIPPED";
  const expected = { attempts: row.attempts };

  // Toda transição é condicionada à linha lida; se perdeu a corrida, avisa e não finge resultado.
  const settle = async (outcome: DispatchOutcome, data: TransitionData): Promise<DispatchOutcome> => {
    if (await store.transition(row.id, expected, data)) return outcome;
    console.warn("NOTIFICATION_TRANSITION_LOST", { notificationId: row.id, expectedAttempts: expected.attempts, outcome });
    return "STALE";
  };

  // Sem transporte a linha fica na fila, sem gastar tentativa: entra quando a chave existir.
  const entry = providers[row.channel];
  if (!entry || !entry.enabled) return settle("NOT_CONFIGURED", { lastError: entry ? entry.reason : "CHANNEL_NOT_SUPPORTED" });

  const rendered = render(row);
  if ("error" in rendered) return settle("FAILED", { status: "FAILED", lastError: rendered.error, nextAttemptAt: null });

  try {
    const { providerMessageId } = await entry.provider.send(row.recipient, rendered, row.eventKey);
    return settle("SENT", { status: "SENT", attempts: row.attempts + 1, sentAt: now, provider: entry.provider.name, providerMessageId, lastError: null, nextAttemptAt: null });
  } catch (error) {
    const attempts = row.attempts + 1;
    const lastError = error instanceof Error ? error.message : String(error);
    // Erro que não veio classificado (rede, bug do SDK) é tratado como transitório.
    const permanent = error instanceof ProviderSendError && error.kind === "permanent";
    if (permanent || attempts >= MAX_ATTEMPTS) return settle("FAILED", { status: "FAILED", attempts, lastError, nextAttemptAt: null });
    const nextAttemptAt = new Date(now.getTime() + BACKOFF_MINUTES[attempts - 1]! * 60_000);
    return settle("RETRY", { attempts, lastError, nextAttemptAt });
  }
}

export type DispatchSummary = { processed: number; sent: number; retried: number; failed: number; notConfigured: number; skipped: number };

export async function dispatchPending(options: DispatchOptions & { limit: number }): Promise<DispatchSummary> {
  const { store } = options;
  const providers = options.providers ?? buildChannelRegistry();
  const now = options.now ?? new Date();
  const summary: DispatchSummary = { processed: 0, sent: 0, retried: 0, failed: 0, notConfigured: 0, skipped: 0 };
  const counters: Record<DispatchOutcome, keyof DispatchSummary> = { SENT: "sent", RETRY: "retried", FAILED: "failed", NOT_CONFIGURED: "notConfigured", SKIPPED: "skipped", NOT_FOUND: "skipped", STALE: "skipped" };

  // Sequencial de propósito: o volume é pequeno e o provedor tem limite de taxa.
  for (const row of await store.listPending(now, options.limit)) {
    const outcome = await dispatchNotification(row.id, { store, providers, now });
    summary.processed += 1;
    summary[counters[outcome]] += 1;
  }
  return summary;
}
