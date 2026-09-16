import { z } from "zod";

import { getPublicBookableDays } from "@/server/data/public-booking";
import { BookingError } from "@/server/services/booking";
import { readServiceIds } from "@/server/services/booking-services";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  serviceIds: z.array(z.string().min(1)).min(1),
  staffId: z.string().min(1).optional(),
});

/* Dias do mês com horário livre para o calendário público. */
export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability/month">) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  // `serviceIds` repetido na query (ou o `serviceId` único dos consumidores internos).
  const parsed = querySchema.safeParse({ ...Object.fromEntries(url.searchParams), serviceIds: readServiceIds(url.searchParams) });
  if (!parsed.success) return Response.json({ error: "INVALID_QUERY" }, { status: 400 });

  try {
    const result = await getPublicBookableDays({ slug, ...parsed.data });
    if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ days: result.days });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ error: error.code }, { status: error.code === "RESOURCE_NOT_FOUND" ? 404 : 400 });
    throw error;
  }
}
