import { z } from "zod";

import { getPublicAvailability } from "@/server/data/public-booking";

const querySchema = z.object({
  date: z.iso.date(),
  serviceId: z.string().min(1),
  staffId: z.string().min(1).optional(),
  // Painel: registra atendimento de hoje que já começou. Só muda o que é listado — a reserva
  // pública sempre recusa horário já iniciado (createPublicBooking recalcula com o corte).
  includeStarted: z.literal("1").optional(),
});

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ error: "INVALID_QUERY" }, { status: 400 });

  const { includeStarted, ...query } = parsed.data;
  const availability = await getPublicAvailability({ slug, ...query, includeStarted: includeStarted === "1" });
  if (!availability) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ slots: availability.slots });
}
