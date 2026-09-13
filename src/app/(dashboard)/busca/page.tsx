import Link from "next/link";
import { StaffAvatar, staffInitials } from "@/components/staff-avatar";
import { CalendarDays, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/server/auth/authorization";
import { tenantDb, tenantTransaction } from "@/server/db";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requirePermission("customers:view");
  const db = tenantDb(session.tenantId);
  const { q = "" } = await searchParams;
  const query = q.trim();
  const professionalStaff = session.role === "PROFESSIONAL" ? await db.staff.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, deletedAt: null }, select: { id: true } }) : undefined;
  const restrictToProfessional = session.role === "PROFESSIONAL";
  const staffId = professionalStaff?.id ?? "__unlinked_professional__";
  const [customers, appointments] = query ? await Promise.all([
    db.customer.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(restrictToProfessional ? { appointments: { some: { staffId } } } : {}), OR: [{ firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }, { email: { contains: query, mode: "insensitive" } }] }, take: 20 }),
    db.appointment.findMany({ where: { tenantId: session.tenantId, deletedAt: null, ...(restrictToProfessional ? { staffId } : {}), OR: [{ customer: { firstName: { contains: query, mode: "insensitive" } } }, { customer: { lastName: { contains: query, mode: "insensitive" } } }, { services: { some: { service: { name: { contains: query, mode: "insensitive" } } } } }] }, include: { customer: true, staff: true, services: { include: { service: true } } }, take: 20 }),
  ]) : [[], []];
  return <div className="flex flex-col gap-6"><section><p className="mb-2 text-xs uppercase tracking-[.18em] text-primary">Busca global</p><h1 className="font-heading text-3xl font-semibold">{query ? `Resultados para “${query}”` : "Digite algo na busca"}</h1></section><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" />Clientes ({customers.length})</CardTitle></CardHeader><CardContent className="space-y-2">{customers.map((customer) => <Link href="/clientes" key={customer.id} className="block rounded-lg border border-white/8 p-3 text-sm hover:bg-white/[.03]">{customer.firstName} {customer.lastName}<span className="ml-2 text-xs text-muted-foreground">{customer.phone}</span></Link>)}{query && customers.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p> : null}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4" />Agendamentos ({appointments.length})</CardTitle></CardHeader><CardContent className="space-y-2">{appointments.map((appointment) => <Link href="/agenda" key={appointment.id} className="block rounded-lg border border-white/8 p-3 text-sm hover:bg-white/[.03]"><span className="flex items-center gap-2"><StaffAvatar imageUrl={appointment.staff.imageUrl} initials={staffInitials(appointment.staff.displayName)} color={appointment.staff.color} className="size-7" /><span className="min-w-0"><span className="block truncate">{appointment.customer.firstName} {appointment.customer.lastName}</span><span className="block truncate text-xs text-muted-foreground">{appointment.services.map((entry) => entry.service.name).join(", ")} · {appointment.staff.displayName}</span></span></span></Link>)}{query && appointments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p> : null}</CardContent></Card></div></div>;
}
