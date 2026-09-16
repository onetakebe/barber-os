import { z } from "zod";

import { getPublicAvailability } from "@/server/data/public-booking";
import { BookingError } from "@/server/services/booking";
import { readServiceIds } from "@/server/services/booking-services";

const querySchema = z.object({
  date: z.iso.date(),
  serviceIds: z.array(z.string().min(1)).min(1),
  staffId: z.string().min(1).optional(),
  // Painel: registra atendimento de hoje que já começou. Só muda o que é listado — a reserva
  // pública sempre recusa horário já iniciado (createPublicBooking recalcula com o corte).
  includeStarted: z.literal("1").optional(),
});

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability">) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  // `serviceIds` repetido na query (ou o `serviceId` único do painel): `getAll`, não `fromEntries`.
  const parsed = querySchema.safeParse({ ...Object.fromEntries(url.searchParams), serviceIds: readServiceIds(url.searchParams) });
  if (!parsed.success) return Response.json({ error: "INVALID_QUERY" }, { status: 400 });

  const { includeStarted, ...query } = parsed.data;
  try {
    const availability = await getPublicAvailability({ slug, ...query, includeStarted: includeStarted === "1" });
    if (!availability) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ slots: availability.slots });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ error: error.code }, { status: error.code === "RESOURCE_NOT_FOUND" ? 404 : 400 });
    throw error;
  }
}
