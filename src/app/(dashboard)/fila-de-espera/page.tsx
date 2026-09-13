import { Clock3, Sparkles } from "lucide-react";

import { AddWaitlistButton, WaitlistOfferButton } from "@/components/dashboard/waitlist-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { authorize } from "@/domain/auth/permissions";
import { requirePermission } from "@/server/auth/authorization";
import { tenantDb } from "@/server/db";

function minuteToTime(minute: number) { return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; }
const euro = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(cents / 100);

export default async function WaitlistPage() {
  const session = await requirePermission("waitlist:view");
  const db = tenantDb(session.tenantId);
  const canEdit = authorize(session.role, "waitlist:edit");
  const [entries, customers, services, staff, accepted] = await Promise.all([
    db.waitlistEntry.findMany({ where: { tenantId: session.tenantId, status: { in: ["WAITING", "OFFERED"] } }, orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }], include: { customer: true, service: true, staff: true } }),
    db.customer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { firstName: "asc" }, take: 200, select: { id: true, firstName: true, lastName: true } }),
    db.service.findMany({ where: { tenantId: session.tenantId, deletedAt: null, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.staff.findMany({ where: { tenantId: session.tenantId, deletedAt: null, isBookable: true }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
    db.waitlistEntry.findMany({ where: { tenantId: session.tenantId, status: "ACCEPTED" }, include: { service: { select: { priceCents: true } } } }),
  ]);
  const recoveredRevenue = accepted.reduce((sum, entry) => sum + entry.service.priceCents, 0);
  return <div className="flex flex-col gap-6"><section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-primary">Recuperação persistida</p><h1 className="font-heading text-3xl font-semibold tracking-[-.035em]">Fila de espera</h1><p className="mt-2 text-sm text-muted-foreground">Ofertas criam registro e notificação simulada no banco.</p></div>{canEdit ? <AddWaitlistButton customers={customers.map((item) => ({ id: item.id, name: `${item.firstName} ${item.lastName}` }))} services={services} staff={staff.map((item) => ({ id: item.id, name: item.displayName }))} /> : null}</section><div className="grid gap-3 sm:grid-cols-3"><Card className="border-primary/20 bg-primary/5"><CardHeader className="pb-1"><CardDescription>Aguardando agora</CardDescription></CardHeader><CardContent className="flex items-center justify-between"><p className="font-heading text-3xl font-semibold">{entries.filter((entry) => entry.status === "WAITING").length}</p><Sparkles className="text-primary" /></CardContent></Card><Card><CardHeader className="pb-1"><CardDescription>Horários recuperados</CardDescription></CardHeader><CardContent><p className="font-heading text-3xl font-semibold">{accepted.length}</p></CardContent></Card><Card><CardHeader className="pb-1"><CardDescription>Receita recuperada</CardDescription></CardHeader><CardContent><p className="font-heading text-3xl font-semibold">{euro(recoveredRevenue)}</p></CardContent></Card></div><div className="grid gap-3">{entries.map((entry, index) => <Card key={entry.id} className="border-white/8"><CardContent className="grid gap-5 p-5 md:grid-cols-[1.2fr_1fr_.6fr_auto] md:items-center"><div><div className="flex items-center gap-2"><p className="font-medium">{entry.customer.firstName} {entry.customer.lastName}</p><Badge variant={index === 0 ? "default" : "secondary"}>#{index + 1}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{entry.service.name} · {entry.staff?.displayName ?? "qualquer profissional"}</p></div><div><p className="flex items-center gap-2 text-xs"><Clock3 className="size-3 text-primary" /> {minuteToTime(entry.windowStartMinute)}–{minuteToTime(entry.windowEndMinute)}</p><p className="mt-1 text-[11px] text-muted-foreground">Antecedência mínima: {entry.minimumNoticeMinutes} min · {entry.status}</p></div><div><div className="mb-2 flex justify-between text-[11px]"><span>Prioridade</span><span className="font-mono">{entry.priorityScore}%</span></div><Progress value={entry.priorityScore} /></div>{canEdit && entry.status === "WAITING" ? <WaitlistOfferButton entryId={entry.id} /> : <Badge variant="outline">Oferta enviada</Badge>}</CardContent></Card>)}{entries.length === 0 ? <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">A fila está vazia.</CardContent></Card> : null}</div></div>;
}
