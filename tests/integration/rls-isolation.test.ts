import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminDb, db, tenantDb } from "@/server/db";

/* Prova da trava no banco (T4): a barbearia A não lê nem grava na B, e sem contexto
   nenhum o banco não devolve nada. Roda contra o banco real do .env. */
describe.sequential("RLS por barbearia", () => {
  let tenantA: string;
  let tenantB: string;
  let customerInB: string;

  beforeAll(async () => {
    const a = await adminDb.tenant.findUniqueOrThrow({ where: { slug: "as-barber-club" }, select: { id: true } });
    tenantA = a.id;
    const b = await adminDb.tenant.create({ data: { name: "RLS Teste B", slug: `rls-teste-b-${Date.now()}`, email: "rls-b@exemplo.com" }, select: { id: true } });
    tenantB = b.id;
    const customer = await tenantDb(tenantB).customer.create({ data: { tenantId: tenantB, firstName: "Cliente", lastName: "Da B", phone: `+32 470 ${Date.now() % 1000000}` }, select: { id: true } });
    customerInB = customer.id;
  });

  afterAll(async () => {
    await adminDb.tenant.delete({ where: { id: tenantB } });
  });

  it("A não enxerga os clientes da B, mesmo pedindo pelo id", async () => {
    const byId = await tenantDb(tenantA).customer.findUnique({ where: { id: customerInB } });
    expect(byId).toBeNull();
    const count = await tenantDb(tenantA).customer.count({ where: { tenantId: tenantB } });
    expect(count).toBe(0);
  });

  it("A não consegue gravar na B, nem alterar o que é da B", async () => {
    await expect(tenantDb(tenantA).customer.create({ data: { tenantId: tenantB, firstName: "Invasor", lastName: "X", phone: "+32 470 00 00 00" } })).rejects.toThrow();
    const updated = await tenantDb(tenantA).customer.updateMany({ where: { id: customerInB }, data: { firstName: "Alterado" } });
    expect(updated.count).toBe(0);
  });

  it("sem contexto de barbearia o banco não devolve nada (fail-closed)", async () => {
    expect(await db.customer.count()).toBe(0);
    expect(await db.tenant.count()).toBe(0);
  });

  it("a própria barbearia continua vendo e gravando o que é dela", async () => {
    const own = await tenantDb(tenantB).customer.findUnique({ where: { id: customerInB } });
    expect(own?.firstName).toBe("Cliente");
    expect(await tenantDb(tenantA).customer.count()).toBeGreaterThan(0);
  });
});
