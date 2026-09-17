import "dotenv/config";

import { describe, expect, it } from "vitest";

import { adminDb } from "@/server/db";

/* Migração 20260917130000: o papel do app roda em UTC. O adapter pg grava timestamptz como
   texto sem offset, então numa sessão em Europe/Brussels o instante entrava deslocado 2h
   (bug aberto desde 08/09, só visível fora do Prisma). Se o ajuste do papel se perder,
   este teste acusa antes de qualquer horário errado chegar ao banco. */
describe("fuso da sessão do app", () => {
  it("a sessão do papel do app está em UTC", async () => {
    const [row] = await adminDb.$queryRaw<{ tz: string }[]>`SELECT current_setting('TimeZone') AS tz`;
    expect(row?.tz).toBe("UTC");
  });
});
