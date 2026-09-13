import { authorize } from "@/domain/auth/permissions";
import { AgendaWorkspace } from "@/components/dashboard/agenda-workspace";
import { requirePermission } from "@/server/auth/authorization";
import { tenantDb } from "@/server/db";
import { getBookableDates } from "@/server/data/public-booking";

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }
function minuteLabel(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }

/** Minutos desde a meia-noite *no fuso da barbearia* — o eixo da grade é local, não UTC. */
function localMinutes(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

const gridStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"] as const;

export default async function AgendaPage() {
  const session = await requirePermission("appointments:view");
  const db = tenantDb(session.tenantId);
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId }, select: { timezone: true, slug: true } });
  const ownStaff = session.role === "PROFESSIONAL" ? await db.staff.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, deletedAt: null }, select: { id: true } }) : null;

  const [appointments, staffRows, windows, services] = await Promise.all([
    db.appointment.findMany({
      where: { tenantId: session.tenantId, deletedAt: null, ...(ownStaff ? { staffId: ownStaff.id } : {}) },
      orderBy: { startsAt: "asc" },
      include: { customer: true, staff: true, services: { include: { service: true } } },
      take: 200,
    }),
    db.staff.findMany({
      where: { tenantId: session.tenantId, deletedAt: null, isBookable: true, ...(ownStaff ? { id: ownStaff.id } : {}) },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, color: true, imageUrl: true },
    }),
    db.availability.findMany({ where: { tenantId: session.tenantId }, select: { startMinute: true, endMinute: true } }),
    db.service.findMany({ where: { tenantId: session.tenantId, isActive: true, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, durationMinutes: true, priceCents: true } }),
  ]);

  const today = new Date();
  const dateKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const clock = new Intl.DateTimeFormat("pt-BR", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit" });
  const todayValue = dateKey(today);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: tenant.timezone, weekday: "short", day: "2-digit", month: "short" }).format(today).replace(".", "");
  const days = [{ value: todayValue, label: todayLabel }, ...getBookableDates(tenant.timezone).slice(0, 6)];

  const rows = appointments.map((item) => ({
    id: item.id,
    dateKey: dateKey(item.startsAt),
    staffId: item.staffId,
    startMinute: localMinutes(item.startsAt, tenant.timezone),
    endMinute: localMinutes(item.endsAt, tenant.timezone),
    time: clock.format(item.startsAt),
    end: clock.format(item.endsAt),
    customer: `${item.customer.firstName} ${item.customer.lastName}`,
    service: item.services.map((entry) => entry.service.name).join(", "),
    staff: item.staff.displayName,
    staffInitials: initials(item.staff.displayName),
    status: item.status,
    onGrid: gridStatuses.includes(item.status as (typeof gridStatuses)[number]),
    cancellable: ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(item.status),
  }));

  // Janela do eixo: menor abertura e maior fechamento registrados na jornada da equipe.
  const dayStartMinute = windows.length ? Math.min(...windows.map((item) => item.startMinute)) : 540;
  const dayEndMinute = windows.length ? Math.max(...windows.map((item) => item.endMinute)) : 1140;

  const canManageTeam = authorize(session.role, "team:edit");
  const staffManagement = canManageTeam ? await db.staff.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      availability: { orderBy: { dayOfWeek: "asc" } },
      timeOff: { where: { endsAt: { gte: today } }, orderBy: { startsAt: "asc" }, take: 30 },
    },
  }) : [];
  const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: tenant.timezone, dateStyle: "short", timeStyle: "short" });
  const availabilityManagement = canManageTeam ? {
    staff: staffManagement.map((member) => ({ id: member.id, name: member.displayName })),
    availability: staffManagement.flatMap((member) => member.availability.map((item) => ({ id: item.id, staffName: member.displayName, dayOfWeek: item.dayOfWeek, hours: `${minuteLabel(item.startMinute)}–${minuteLabel(item.endMinute)}`, breakHours: item.breakStartMinute !== null && item.breakEndMinute !== null ? `Intervalo ${minuteLabel(item.breakStartMinute)}–${minuteLabel(item.breakEndMinute)}` : "Sem intervalo" }))),
    timeOff: staffManagement.flatMap((member) => member.timeOff.map((item) => ({ id: item.id, staffName: member.displayName, period: `${dateTime.format(item.startsAt)} – ${dateTime.format(item.endsAt)}`, reason: item.reason ?? "Indisponibilidade" }))),
  } : undefined;

  return (
    <AgendaWorkspace
      appointments={rows}
      staff={staffRows.map((member) => ({ id: member.id, name: member.displayName, initials: initials(member.displayName), color: member.color, imageUrl: member.imageUrl }))}
      services={services}
      days={days}
      todayValue={todayValue}
      dayStartMinute={dayStartMinute}
      dayEndMinute={dayEndMinute}
      timezone={tenant.timezone}
      tenantSlug={tenant.slug}
      canEdit={authorize(session.role, "appointments:edit")}
      availabilityManagement={availabilityManagement}
    />
  );
}
