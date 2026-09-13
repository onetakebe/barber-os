import { db } from "@/server/db";
import { getPublicAvailability } from "@/server/data/public-booking";
import { localDateTimeToUtc } from "@/server/services/availability";

function localDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }

export async function getDashboardData(tenantId: string, options: { professionalStaffId?: string | null; canViewFinance: boolean }) {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, slug: true, timezone: true } });
  const now = new Date();
  const today = localDate(now, tenant.timezone);
  const tomorrow = addDays(today, 1);
  const monthStart = `${today.slice(0, 7)}-01`;
  const startsToday = localDateTimeToUtc(today, "00:00", tenant.timezone);
  const endsToday = localDateTimeToUtc(tomorrow, "00:00", tenant.timezone);
  const startsMonth = localDateTimeToUtc(monthStart, "00:00", tenant.timezone);
  const startsTrend = localDateTimeToUtc(addDays(today, -13), "00:00", tenant.timezone);
  const startsDataWindow = startsMonth < startsTrend ? startsMonth : startsTrend;
  const activeStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const;
  const restrictToProfessional = options.professionalStaffId !== undefined;
  const scopedStaffId = options.professionalStaffId ?? "__unlinked_professional__";
  const appointmentScope = restrictToProfessional ? { staffId: scopedStaffId } : {};
  const customerScope = restrictToProfessional ? { appointments: { some: { staffId: scopedStaffId } } } : {};

  const [todayAppointments, monthAppointments, customerCount, staff, availability, deposits, waitlistAccepted, campaignRevenue, lowStock, waitingCount, firstService, sales] = await Promise.all([
    db.appointment.findMany({ where: { tenantId, deletedAt: null, startsAt: { gte: startsToday, lt: endsToday }, ...appointmentScope }, orderBy: { startsAt: "asc" }, include: { customer: true, staff: true, services: { include: { service: true } } } }),
    db.appointment.findMany({ where: { tenantId, deletedAt: null, startsAt: { gte: startsDataWindow }, status: "COMPLETED", ...appointmentScope }, select: { totalCents: true, startsAt: true, staffId: true } }),
    db.customer.count({ where: { tenantId, deletedAt: null, ...customerScope } }),
    db.staff.findMany({ where: { tenantId, deletedAt: null, ...(restrictToProfessional ? { id: scopedStaffId } : {}) }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, color: true, imageUrl: true, appointments: { where: { tenantId, deletedAt: null, status: "COMPLETED", startsAt: { gte: startsMonth } }, select: { totalCents: true, startsAt: true, endsAt: true } } } }),
    db.availability.findMany({ where: { tenantId, ...(restrictToProfessional ? { staffId: scopedStaffId } : {}) }, select: { staffId: true, dayOfWeek: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } }),
    db.deposit.aggregate({ where: { tenantId, status: { in: ["PAID", "APPLIED_TO_SERVICE", "CONVERTED_TO_CREDIT"] } }, _sum: { amountCents: true } }),
    db.waitlistEntry.findMany({ where: { tenantId, status: "ACCEPTED" }, include: { service: { select: { priceCents: true } } } }),
    db.campaignDelivery.aggregate({ where: { tenantId, convertedAt: { not: null } }, _sum: { revenueCents: true } }),
    db.product.count({ where: { tenantId, deletedAt: null, isActive: true, stock: { lte: db.product.fields.minimumStock } } }),
    db.waitlistEntry.count({ where: { tenantId, status: "WAITING" } }),
    db.service.findFirst({ where: { tenantId, isActive: true, deletedAt: null }, orderBy: { durationMinutes: "asc" }, select: { id: true } }),
    db.sale.findMany({ where: { tenantId, createdAt: { gte: startsDataWindow } }, select: { totalCents: true, createdAt: true } }),
  ]);

  const publicAvailability = firstService ? await getPublicAvailability({ slug: tenant.slug, date: today, serviceId: firstService.id, staffId: restrictToProfessional ? scopedStaffId : "any" }) : null;
  const staffById = new Map(staff.map((member) => [member.id, member.displayName]));
  const freeSlots = (publicAvailability?.slots ?? []).filter((slot) => new Date(slot.startsAt) > now).slice(0, 4).map((slot) => ({ time: slot.time, staff: slot.staffIds.map((id) => staffById.get(id)).filter(Boolean).join(", "), fit: `${slot.staffIds.length} profissional(is)` }));

  const serviceRevenue = monthAppointments.filter((item) => item.startsAt >= startsMonth).reduce((sum, item) => sum + item.totalCents, 0);
  const productRevenue = sales.filter((item) => item.createdAt >= startsMonth).reduce((sum, item) => sum + item.totalCents, 0);
  const monthRevenue = serviceRevenue + productRevenue;
  const monthCompleted = monthAppointments.filter((item) => item.startsAt >= startsMonth).length;
  const availableMinutes = availability.reduce((sum, item) => sum + item.endMinute - item.startMinute - (item.breakStartMinute !== null && item.breakEndMinute !== null ? item.breakEndMinute - item.breakStartMinute : 0), 0);
  const actualBookedMinutes = staff.reduce((sum, member) => sum + member.appointments.reduce((minutes, item) => minutes + Math.round((item.endsAt.getTime() - item.startsAt.getTime()) / 60_000), 0), 0);
  const elapsedWeeks = Math.max(1, Number(today.slice(8, 10)) / 7);
  const occupancy = availableMinutes > 0 ? Math.min(100, Math.round((actualBookedMinutes / (availableMinutes * elapsedWeeks)) * 100)) : 0;

  const revenueByDate = new Map<string, number>();
  for (const appointment of monthAppointments) revenueByDate.set(localDate(appointment.startsAt, tenant.timezone), (revenueByDate.get(localDate(appointment.startsAt, tenant.timezone)) ?? 0) + appointment.totalCents);
  for (const sale of sales) revenueByDate.set(localDate(sale.createdAt, tenant.timezone), (revenueByDate.get(localDate(sale.createdAt, tenant.timezone)) ?? 0) + sale.totalCents);
  const revenueTrend = Array.from({ length: 14 }, (_, index) => { const date = addDays(today, index - 13); return { label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`)), revenue: (revenueByDate.get(date) ?? 0) / 100 }; });

  const protectedRevenue = deposits._sum.amountCents ?? 0;
  const waitlistRevenue = waitlistAccepted.reduce((sum, entry) => sum + entry.service.priceCents, 0);
  const campaignRecovered = campaignRevenue._sum.revenueCents ?? 0;
  return {
    tenant,
    today,
    metrics: [
      options.canViewFinance
        ? { label: "Receita do mês", value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(monthRevenue / 100), change: `${monthCompleted} atendimentos` }
        : { label: "Atendimentos no mês", value: String(monthCompleted), change: "concluídos" },
      { label: "Reservas hoje", value: String(todayAppointments.length), change: `${todayAppointments.filter((item) => activeStatuses.includes(item.status as (typeof activeStatuses)[number])).length} ativas` },
      { label: "Ocupação calculada", value: `${occupancy}%`, change: "pela jornada" },
      { label: "Clientes", value: String(customerCount), change: "no tenant" },
    ],
    appointments: todayAppointments.map((item) => ({ id: item.id, time: new Intl.DateTimeFormat("pt-BR", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" }).format(item.startsAt), customer: `${item.customer.firstName} ${item.customer.lastName}`, service: item.services.map((entry) => entry.service.name).join(", "), staff: item.staff.displayName, status: item.status })),
    staff: staff.map((member) => { const minutes = member.appointments.reduce((sum, item) => sum + Math.round((item.endsAt.getTime() - item.startsAt.getTime()) / 60_000), 0); const weeklyMinutes = availability.filter((item) => item.staffId === member.id).reduce((sum, item) => sum + item.endMinute - item.startMinute - (item.breakStartMinute !== null && item.breakEndMinute !== null ? item.breakEndMinute - item.breakStartMinute : 0), 0); return { id: member.id, name: member.displayName, initials: initials(member.displayName), color: member.color, imageUrl: member.imageUrl, revenue: options.canViewFinance ? member.appointments.reduce((sum, item) => sum + item.totalCents, 0) : 0, occupancy: weeklyMinutes ? Math.min(100, Math.round((minutes / (weeklyMinutes * elapsedWeeks)) * 100)) : 0 }; }),
    revenueTrend,
    freeSlots,
    impact: { total: protectedRevenue + waitlistRevenue + campaignRecovered, deposits: protectedRevenue, waitlist: waitlistRevenue, campaigns: campaignRecovered },
    insights: [
      lowStock > 0 ? { title: "Estoque requer atenção", detail: `${lowStock} produto(s) atingiram o mínimo.`, impact: `${lowStock} alerta(s)`, kind: "warning" as const } : { title: "Estoque sob controle", detail: "Nenhum produto abaixo do mínimo.", impact: "Tudo em dia", kind: "positive" as const },
      waitingCount > 0 ? { title: "Fila pronta para trabalhar", detail: `${waitingCount} cliente(s) aguardam uma vaga compatível.`, impact: `${waitingCount} oportunidades`, kind: "positive" as const } : { title: "Fila de espera vazia", detail: "Divulgue a fila nos horários mais disputados.", impact: "Ação sugerida", kind: "warning" as const },
    ],
  };
}
