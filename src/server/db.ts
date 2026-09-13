import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/* Acesso ao banco com a trava por barbearia (RLS, etapa 2 / T4).
   - `db`: cliente cru, papel barber_app. Sem contexto de barbearia o Postgres não
     devolve nem aceita nada — é o comportamento fail-closed desejado.
   - `tenantDb(tenantId)`: cada operação roda numa transação com app.tenant_id setado.
   - `adminDb`: para o pouco que precisa ver tudo (login, cadastro, resolver slug público).
   - Transações interativas: `tenantTransaction` / `adminTransaction` setam o contexto
     na própria transação (uma extensão não consegue fazer isso por dentro). */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_MISSING");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

type Scope = { key: "app.tenant_id"; value: string } | { key: "app.bypass_rls"; value: "on" };

function scopedClient(scope: Scope) {
  return db.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await db.$transaction([
            db.$executeRaw`SELECT set_config(${scope.key}, ${scope.value}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedClient>;
export type TransactionDb = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const tenantClients = new Map<string, ScopedDb>();

export function tenantDb(tenantId: string): ScopedDb {
  if (!tenantId) throw new Error("TENANT_ID_MISSING");
  let client = tenantClients.get(tenantId);
  if (!client) {
    client = scopedClient({ key: "app.tenant_id", value: tenantId });
    tenantClients.set(tenantId, client);
  }
  return client;
}

export const adminDb: ScopedDb = scopedClient({ key: "app.bypass_rls", value: "on" });

export function tenantTransaction<T>(tenantId: string, fn: (tx: TransactionDb) => Promise<T>): Promise<T> {
  if (!tenantId) throw new Error("TENANT_ID_MISSING");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, TRUE)`;
    return fn(tx);
  });
}

export function adminTransaction<T>(fn: (tx: TransactionDb) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    return fn(tx);
  });
}
