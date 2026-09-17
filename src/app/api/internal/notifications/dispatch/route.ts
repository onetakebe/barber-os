import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { adminDb } from "@/server/db";
import { dispatchPending } from "@/server/notifications/dispatch";
import { prismaNotificationStore } from "@/server/notifications/store";

/* Retentativa manual das notificações pendentes (Bloco 1 / ticket 3). Sem cron nem webhook:
   quem tiver o segredo chama por curl (docs/notifications.md). Atravessa barbearias, por isso
   `adminDb`; a rota se autentica sozinha e fica fora do proxy de sessão (`api/internal`). */

const bodySchema = z.object({ limit: z.number().int().min(1).max(500).default(100) });

function authorized(request: Request): boolean {
  const secret = process.env.NOTIFICATIONS_DISPATCH_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  // Sem segredo configurado a rota fica fechada (fail-closed), não aberta.
  if (!secret || !token) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Corpo vazio vale como `{}`; JSON quebrado vira erro de validação, não 500. */
async function readJson(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "INVALID_BODY" }, { status: 400 });

  const summary = await dispatchPending({ limit: parsed.data.limit, store: prismaNotificationStore(adminDb) });
  return Response.json(summary);
}
