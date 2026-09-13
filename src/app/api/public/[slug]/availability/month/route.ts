import { z } from "zod";

import { getPublicBookableDays } from "@/server/data/public-booking";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  serviceId: z.string().min(1),
  staffId: z.string().min(1).optional(),
});

/* Dias do mês com horário livre para o calendário público. */
export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/availability/month">) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ error: "INVALID_QUERY" }, { status: 400 });

  const result = await getPublicBookableDays({ slug, ...parsed.data });
  if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ days: result.days });
}
