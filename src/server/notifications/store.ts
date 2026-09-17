import type { Notification } from "@/generated/prisma/client";
import { adminDb, type ScopedDb } from "@/server/db";

/* Leitura e transição das linhas da fila. A interface existe para a máquina de estados ser
   testada sem banco; a implementação Prisma é a única usada em produção. */

export type QueuedNotification = Pick<Notification, "id" | "tenantId" | "channel" | "status" | "recipient" | "templateKey" | "eventKey" | "metadata" | "attempts" | "nextAttemptAt">;

export type TransitionData = Partial<Pick<Notification, "status" | "attempts" | "nextAttemptAt" | "lastError" | "sentAt" | "provider" | "providerMessageId">>;

export type NotificationStore = {
  find(id: string): Promise<QueuedNotification | null>;
  /** QUEUED com eventKey (linhas legadas de envio simulado nunca entram) e retentativa vencida. */
  listPending(now: Date, limit: number): Promise<QueuedNotification[]>;
  /** Só aplica se a linha ainda estiver QUEUED com as tentativas esperadas: duas execuções
   *  simultâneas (after() da reserva e o endpoint interno) não se atropelam. */
  transition(id: string, expected: { attempts: number }, data: TransitionData): Promise<boolean>;
};

const select = { id: true, tenantId: true, channel: true, status: true, recipient: true, templateKey: true, eventKey: true, metadata: true, attempts: true, nextAttemptAt: true } as const;

/** `adminDb` atravessa barbearias (endpoint interno); a reserva passa o `tenantDb` dela. */
export function prismaNotificationStore(db: ScopedDb = adminDb): NotificationStore {
  return {
    find: (id) => db.notification.findUnique({ where: { id }, select }),
    listPending: (now, limit) =>
      db.notification.findMany({
        where: { status: "QUEUED", eventKey: { not: null }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        orderBy: { createdAt: "asc" },
        take: limit,
        select,
      }),
    transition: async (id, expected, data) => {
      const result = await db.notification.updateMany({ where: { id, status: "QUEUED", attempts: expected.attempts }, data });
      return result.count === 1;
    },
  };
}
