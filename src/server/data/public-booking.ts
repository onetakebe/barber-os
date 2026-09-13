import { adminDb, tenantDb } from "@/server/db";
import { getAvailableSlotsFromRecords, localDateTimeToUtc } from "@/server/services/availability";

const activeStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;

function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function getBookableDates(timezone: string, now = new Date()) {
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now.getTime() + (index + 1) * 86_400_000);
    const value = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    const label = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, weekday: "short", day: "2-digit", month: "short" }).format(date).replace(".", "");
    return { value, label };
  });
}

export async function getPublicBookingCatalog(slug: string) {
  // A página pública chega por slug, sem barbearia conhecida: só esta leitura ignora a trava.
  const tenant = await adminDb.tenant.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      currency: true,
      description: true,
      address: true,
      city: true,
      phone: true,
      cancellationNoticeHours: true,
      defaultDepositCents: true,
      services: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, description: true, priceCents: true, durationMinutes: true, depositRequired: true },
      },
      staff: {
        where: { isBookable: true, deletedAt: null },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, title: true, imageUrl: true, services: { select: { serviceId: true } } },
      },
      reviews: {
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, rating: true, comment: true, customer: { select: { firstName: true, lastName: true } } },
      },
      // Vitrine: só produtos ativos de varejo; estoque entra para sinalizar "últimas unidades".
      products: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        take: 8,
        select: { id: true, name: true, description: true, brand: true, category: true, priceCents: true, stock: true, minimumStock: true, imageUrl: true },
      },
    },
  });
  if (!tenant) return null;
  const db = tenantDb(tenant.id);

  const ratings = await db.review.groupBy({
    by: ["staffId"],
    where: { tenantId: tenant.id, isPublic: true, staffId: { in: tenant.staff.map((member) => member.id) } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingByStaff = new Map(ratings.map((row) => [row.staffId, { average: row._avg.rating, count: row._count.rating }]));

  return {
    ...tenant,
    staff: tenant.staff.map((member) => {
      const summary = ratingByStaff.get(member.id);
      return { ...member, rating: summary?.average ?? null, reviewCount: summary?.count ?? 0 };
    }),
  };
}

/** Núcleo da disponibilidade, por tenant. A reserva pública chega por slug; o painel já tem o
 *  tenantId da sessão e não deve pagar uma consulta a mais nem duplicar a regra. */
export async function getAvailabilityForTenant(input: { tenantId: string; timezone: string; date: string; serviceId: string; staffId?: string }) {
  const db = tenantDb(input.tenantId);
  const service = await db.service.findFirst({ where: { id: input.serviceId, tenantId: input.tenantId, isActive: true, deletedAt: null }, select: { id: true, durationMinutes: true } });
  if (!service) return null;

  const startsAt = localDateTimeToUtc(input.date, "00:00", input.timezone);
  const endsAt = localDateTimeToUtc(nextDate(input.date), "00:00", input.timezone);
  const staff = await db.staff.findMany({
    where: {
      tenantId: input.tenantId,
      deletedAt: null,
      isBookable: true,
      ...(input.staffId && input.staffId !== "any" ? { id: input.staffId } : {}),
      services: { some: { tenantId: input.tenantId, serviceId: service.id } },
    },
    select: {
      id: true,
      availability: { where: { tenantId: input.tenantId }, select: { dayOfWeek: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } },
      timeOff: { where: { tenantId: input.tenantId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { startsAt: true, endsAt: true } },
      appointments: { where: { tenantId: input.tenantId, deletedAt: null, status: { in: [...activeStatuses] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { startsAt: true, endsAt: true } },
    },
  });

  const slots = getAvailableSlotsFromRecords({ date: input.date, timezone: input.timezone, durationMinutes: service.durationMinutes, intervalMinutes: 15, staff }).filter((slot) => slot.staffIds.length > 0);
  return { tenantId: input.tenantId, serviceId: service.id, timezone: input.timezone, slots };
}

export async function getPublicAvailability(input: { slug: string; date: string; serviceId: string; staffId?: string }) {
  const tenant = await adminDb.tenant.findFirst({ where: { slug: input.slug, deletedAt: null }, select: { id: true, timezone: true } });
  if (!tenant) return null;
  return getAvailabilityForTenant({ tenantId: tenant.id, timezone: tenant.timezone, date: input.date, serviceId: input.serviceId, staffId: input.staffId });
}
