import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminDb, tenantDb, type ScopedDb } from "@/server/db";

describe.sequential("PostgreSQL persistence invariants", () => {
  let tenantId: string;
  let db: ScopedDb;
  let customerId: string;
  let staffId: string;
  const appointmentIds = ["e2e-conflict-a", "e2e-conflict-b"];

  beforeAll(async () => {
    const tenant = await adminDb.tenant.findUniqueOrThrow({ where: { slug: "as-barber-club" }, select: { id: true } });
    db = tenantDb(tenant.id);
    const staff = await db.staff.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null }, select: { id: true } });
    const customer = await db.customer.create({ data: { tenantId: tenant.id, firstName: "Conflito", lastName: "Integration", phone: "+32 470 00 99 01" } });
    tenantId = tenant.id;
    staffId = staff.id;
    customerId = customer.id;
  });

  afterAll(async () => {
    await db.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    if (customerId) await db.customer.deleteMany({ where: { id: customerId, tenantId } });
  });

  it("rejects overlapping active appointments for the same professional", async () => {
    const startsAt = new Date("2035-01-15T09:00:00.000Z");
    const endsAt = new Date("2035-01-15T09:45:00.000Z");
    await db.appointment.create({ data: { id: appointmentIds[0], tenantId, customerId, staffId, startsAt, endsAt, status: "CONFIRMED", totalCents: 3000, depositCents: 500 } });

    await expect(db.appointment.create({ data: { id: appointmentIds[1], tenantId, customerId, staffId, startsAt: new Date("2035-01-15T09:15:00.000Z"), endsAt: new Date("2035-01-15T10:00:00.000Z"), status: "CONFIRMED", totalCents: 3000, depositCents: 500 } })).rejects.toThrow();

    await expect(db.appointment.count({ where: { id: { in: appointmentIds } } })).resolves.toBe(1);
  });

  it("does not return a resource when queried through another tenant scope", async () => {
    const otherTenant = await adminDb.tenant.findUniqueOrThrow({ where: { slug: "north-cut-demo" }, select: { id: true } });
    await expect(db.customer.findFirst({ where: { id: customerId, tenantId: otherTenant.id } })).resolves.toBeNull();
  });
});
