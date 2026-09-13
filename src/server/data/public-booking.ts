import { adminDb, tenantDb, type ScopedDb } from "@/server/db";
import { addDays, getAvailableSlotsFromRecords, getBookableDaysFromRecords, localDateInZone, localDateTimeToUtc } from "@/server/services/availability";

const activeStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;
const SLOT_INTERVAL_MINUTES = 15;
/** Janela da reserva pública: hoje + 60 dias (decisão de 13/09). */
export const BOOKING_HORIZON_DAYS = 60;

function nextDate(date: string) {
  return addDays(date, 1);
}

function nextMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${monthIndex === 12 ? year + 1 : year}-${String(monthIndex === 12 ? 1 : monthIndex + 1).padStart(2, "0")}`;
}

/** Faixa do calendário público no fuso do tenant: primeiro e último dia marcáveis e os meses que os contêm. */
export function getBookingWindow(timezone: string, now = new Date()) {
  const today = localDateInZone(now, timezone);
  const last = addDays(today, BOOKING_HORIZON_DAYS);
  return { today, last, firstMonth: today.slice(0, 7), lastMonth: last.slice(0, 7) };
}

/** Só a agenda interna usa esta faixa curta (chips de 7 dias). A reserva pública usa o calendário de mês. */
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
/** Jornada, bloqueios e agendamentos ativos dos profissionais elegíveis num intervalo — base
 *  tanto dos horários de um dia quanto dos dias de um mês. */
async function loadStaffRecords(db: ScopedDb, input: { tenantId: string; serviceId: string; staffId?: string; startsAt: Date; endsAt: Date }) {
  return db.staff.findMany({
    where: {
      tenantId: input.tenantId,
      deletedAt: null,
      isBookable: true,
      ...(input.staffId && input.staffId !== "any" ? { id: input.staffId } : {}),
      services: { some: { tenantId: input.tenantId, serviceId: input.serviceId } },
    },
    select: {
      id: true,
      availability: { where: { tenantId: input.tenantId }, select: { dayOfWeek: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } },
      timeOff: { where: { tenantId: input.tenantId, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } }, select: { startsAt: true, endsAt: true } },
      appointments: { where: { tenantId: input.tenantId, deletedAt: null, status: { in: [...activeStatuses] }, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } }, select: { startsAt: true, endsAt: true } },
    },
  });
}

/** Núcleo da disponibilidade, por tenant. A reserva pública chega por slug; o painel já tem o
 *  tenantId da sessão e não deve pagar uma consulta a mais nem duplicar a regra.
 *  `now` corta horários já começados — só a reserva pública passa; o painel pode registrar um
 *  atendimento de hoje que já começou. */
export async function getAvailabilityForTenant(input: { tenantId: string; timezone: string; date: string; serviceId: string; staffId?: string; now?: Date }) {
  const db = tenantDb(input.tenantId);
  const service = await db.service.findFirst({ where: { id: input.serviceId, tenantId: input.tenantId, isActive: true, deletedAt: null }, select: { id: true, durationMinutes: true } });
  if (!service) return null;

  const startsAt = localDateTimeToUtc(input.date, "00:00", input.timezone);
  const endsAt = localDateTimeToUtc(nextDate(input.date), "00:00", input.timezone);
  const staff = await loadStaffRecords(db, { tenantId: input.tenantId, serviceId: service.id, staffId: input.staffId, startsAt, endsAt });

  const slots = getAvailableSlotsFromRecords({ date: input.date, timezone: input.timezone, durationMinutes: service.durationMinutes, intervalMinutes: SLOT_INTERVAL_MINUTES, staff, now: input.now }).filter((slot) => slot.staffIds.length > 0);
  return { tenantId: input.tenantId, serviceId: service.id, timezone: input.timezone, slots };
}

/** Dias de um mês (YYYY-MM) com pelo menos um horário livre — uma consulta para o mês inteiro. */
export async function getBookableDaysForTenant(input: { tenantId: string; timezone: string; month: string; serviceId: string; staffId?: string; now?: Date }) {
  const db = tenantDb(input.tenantId);
  const service = await db.service.findFirst({ where: { id: input.serviceId, tenantId: input.tenantId, isActive: true, deletedAt: null }, select: { id: true, durationMinutes: true } });
  if (!service) return null;

  const startsAt = localDateTimeToUtc(`${input.month}-01`, "00:00", input.timezone);
  const endsAt = localDateTimeToUtc(`${nextMonth(input.month)}-01`, "00:00", input.timezone);
  const staff = await loadStaffRecords(db, { tenantId: input.tenantId, serviceId: service.id, staffId: input.staffId, startsAt, endsAt });

  const days = getBookableDaysFromRecords({ month: input.month, timezone: input.timezone, now: input.now ?? new Date(), horizonDays: BOOKING_HORIZON_DAYS, durationMinutes: service.durationMinutes, intervalMinutes: SLOT_INTERVAL_MINUTES, staff });
  return { tenantId: input.tenantId, serviceId: service.id, timezone: input.timezone, days };
}

export async function getPublicAvailability(input: { slug: string; date: string; serviceId: string; staffId?: string; includeStarted?: boolean }) {
  const tenant = await adminDb.tenant.findFirst({ where: { slug: input.slug, deletedAt: null }, select: { id: true, timezone: true } });
  if (!tenant) return null;
  return getAvailabilityForTenant({ tenantId: tenant.id, timezone: tenant.timezone, date: input.date, serviceId: input.serviceId, staffId: input.staffId, now: input.includeStarted ? undefined : new Date() });
}

export async function getPublicBookableDays(input: { slug: string; month: string; serviceId: string; staffId?: string }) {
  const tenant = await adminDb.tenant.findFirst({ where: { slug: input.slug, deletedAt: null }, select: { id: true, timezone: true } });
  if (!tenant) return null;
  return getBookableDaysForTenant({ tenantId: tenant.id, timezone: tenant.timezone, month: input.month, serviceId: input.serviceId, staffId: input.staffId });
}

/** Primeiro horário livre dentro da janela pública (hero da página da barbearia). */
export async function getNextPublicSlot(input: { tenantId: string; timezone: string; serviceId: string }) {
  const window = getBookingWindow(input.timezone);
  for (let month = window.firstMonth; month <= window.lastMonth; month = nextMonth(month)) {
    const result = await getBookableDaysForTenant({ tenantId: input.tenantId, timezone: input.timezone, month, serviceId: input.serviceId, staffId: "any" });
    const day = result?.days.find((item) => item.available);
    if (!day) continue;
    const availability = await getAvailabilityForTenant({ tenantId: input.tenantId, timezone: input.timezone, date: day.date, serviceId: input.serviceId, staffId: "any", now: new Date() });
    const slot = availability?.slots[0];
    if (slot) return { date: day.date, time: slot.time };
  }
  return null;
}
