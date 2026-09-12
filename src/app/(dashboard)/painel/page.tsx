import Link from "next/link";
import { ArrowRight, CalendarClock, CircleAlert, Clock3, Scissors, TrendingUp, Users } from "lucide-react";

import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { QuickAppointment } from "@/components/dashboard/quick-action";
import { StaffPhoto } from "@/components/staff-photo";
import { StaffAvatar } from "@/components/staff-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { authorize } from "@/domain/auth/permissions";
import { requirePermission } from "@/server/auth/authorization";
import { getDashboardData } from "@/server/data/dashboard";
import { db } from "@/server/db";

const euro = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

export default async function DashboardPage() {
  const session = await requirePermission("appointments:view");
  const canViewFinance = authorize(session.role, "finance:view");
  const canEditAppointments = authorize(session.role, "appointments:edit");
  const canManageWaitlist = authorize(session.role, "waitlist:edit");
  const canViewInsights = authorize(session.role, "waitlist:view") || authorize(session.role, "products:view");
  const professionalStaff = session.role === "PROFESSIONAL" ? await db.staff.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, deletedAt: null }, select: { id: true } }) : undefined;
  const data = await getDashboardData(session.tenantId, { professionalStaffId: professionalStaff?.id ?? (session.role === "PROFESSIONAL" ? null : undefined), canViewFinance });
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${data.today}T12:00:00Z`));
  const hasRevenue = data.revenueTrend.some((point) => point.revenue !== 0);
  const statuses: Record<string, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", CHECKED_IN: "Chegou", IN_PROGRESS: "Em atendimento", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };

  return (
    <div className="dashboard-workspace flex min-w-0 flex-col gap-6 p-4 sm:gap-7 sm:p-6 xl:p-8">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="mb-3 text-xs capitalize text-muted-foreground">{dateLabel}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Olá, {session.name.split(" ")[0]}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Seu dia, sua equipe. Tudo em um só lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/agenda"><CalendarClock data-icon="inline-start" /> Ver agenda</Link></Button>
          {canEditAppointments ? <QuickAppointment tenantSlug={data.tenant.slug} /> : null}
        </div>
      </section>

      <section aria-label="Resumo da operação" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="dashboard-card min-w-0 px-4 py-5 sm:px-5">
            <p className="text-xs text-muted-foreground">{metric.label === "Ocupação calculada" ? "Ocupação da equipe" : metric.label}</p>
            <p className="font-heading mt-3 text-3xl font-semibold tracking-[-.045em]">{metric.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{metric.change === "no tenant" ? "na sua barbearia" : metric.change === "pela jornada" ? "sobre a jornada registrada" : metric.change}</p>
          </div>
        ))}
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="dashboard-card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-5 sm:px-6">
            <div><h2 className="font-heading text-xl font-semibold">Agenda de hoje</h2><p className="mt-1 text-xs text-muted-foreground">{data.appointments.length} {data.appointments.length === 1 ? "reserva para hoje" : "reservas para hoje"}</p></div>
            <Link href="/agenda" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-white">Agenda completa <ArrowRight className="size-3.5" /></Link>
          </div>
          <div className="flex gap-5 overflow-x-auto border-b border-white/8 bg-white/[.025] px-5 py-4 sm:px-6">
            {data.staff.map((member) => <div key={member.id} className="flex shrink-0 items-center gap-2.5"><StaffAvatar imageUrl={member.imageUrl} initials={member.initials} color={member.color} className="size-9" /><span className="text-xs">{member.name}</span></div>)}
            {!data.staff.length ? <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p> : null}
          </div>
          {data.appointments.length ? (
            <div className="divide-y divide-white/8 px-5 sm:px-6">
              {data.appointments.slice(0, 6).map((appointment) => (
                <div key={appointment.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-3 py-4 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto]">
                  <span className="font-mono pt-1 text-xs text-muted-foreground">{appointment.time}</span>
                  <div className="min-w-0"><p className="text-sm font-medium">{appointment.customer}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{appointment.service} · {appointment.staff}</p></div>
                  <Badge variant="secondary" className="col-start-2 w-fit sm:col-start-auto">{statuses[appointment.status] ?? appointment.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-9 text-center">
              <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-white/10 bg-surface-raised"><CalendarClock className="size-5 text-muted-foreground" /></div>
              <h3 className="font-heading text-lg font-medium">Um dia com espaço para novos encontros.</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Nenhuma reserva para hoje. Consulte a agenda para organizar os próximos atendimentos.</p>
              <Link href="/agenda" className="mt-5 inline-flex items-center gap-2 text-sm underline decoration-white/30 underline-offset-4">Abrir agenda <ArrowRight className="size-3.5" /></Link>
            </div>
          )}
        </div>
        <aside className="light-panel flex flex-col rounded-[18px] p-5 sm:p-6">
          <Clock3 className="mb-5 size-5" />
          <h2 className="font-heading text-xl font-semibold tracking-tight">Próximos horários</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Vagas de hoje para o serviço mais curto.</p>
          <div className="my-5 flex flex-1 flex-col gap-3">
            {data.freeSlots.map((slot) => <div key={slot.time} className="rounded-xl bg-black/5 p-4"><p className="font-heading text-xl font-semibold">{slot.time}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{slot.staff || slot.fit}</p>{canManageWaitlist ? <Link href="/fila-de-espera" className="mt-3 inline-flex items-center gap-2 text-xs font-medium underline underline-offset-4">Preencher horário <ArrowRight className="size-3" /></Link> : null}</div>)}
            {!data.freeSlots.length ? <div className="rounded-xl bg-black/5 p-4"><p className="text-sm font-medium">Por hoje, sem novas vagas.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Veja os próximos dias na agenda.</p></div> : null}
          </div>
          <Button asChild className="w-full"><Link href="/agenda">Ver agenda <ArrowRight data-icon="inline-end" /></Link></Button>
        </aside>
      </section>

      <section className="dashboard-card p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div><h2 className="font-heading text-xl font-semibold">{session.role === "PROFESSIONAL" ? "Meu desempenho" : "Os rostos do seu clube"}</h2><p className="mt-1 text-xs text-muted-foreground">Equipe e movimento deste mês.</p></div>
          {authorize(session.role, "team:edit") ? <Link href="/equipe" className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground hover:text-white">Ver equipe <ArrowRight className="size-3.5" /></Link> : <Users className="size-5 text-muted-foreground" />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {data.staff.map((member) => (
            <article key={member.id} className="flex min-w-0 overflow-hidden rounded-xl border border-white/8 bg-surface-raised">
              <div className="relative w-24 shrink-0 self-stretch bg-black/10 sm:w-28">
                {member.imageUrl ? <StaffPhoto src={member.imageUrl} alt={member.name} sizes="112px" className="object-cover object-top" /> : <div className="flex h-full min-h-36 items-center justify-center"><StaffAvatar imageUrl={null} initials={member.initials} className="size-12" /></div>}
              </div>
              <div className="min-w-0 flex-1 p-4"><h3 className="font-heading text-sm font-semibold">{member.name}</h3><p className="mt-3 text-xs text-muted-foreground">Ocupação · {member.occupancy}%</p><Progress value={member.occupancy} className="mt-2 h-1" />{canViewFinance ? <p className="mt-4 font-mono text-sm">{euro(member.revenue)} <span className="font-sans text-[10px] text-muted-foreground">no mês</span></p> : null}</div>
            </article>
          ))}
          {!data.staff.length ? <p className="py-5 text-sm text-muted-foreground">Sua equipe aparecerá aqui quando estiver cadastrada.</p> : null}
        </div>
      </section>

      {canViewFinance ? <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(250px,.6fr)]">
        <Card className="dashboard-card min-w-0"><CardHeader><CardTitle className="font-heading text-lg">Faturamento em movimento</CardTitle><CardDescription>Receita dos últimos 14 dias.</CardDescription></CardHeader><CardContent>{hasRevenue ? <RevenueChart data={data.revenueTrend} /> : <div className="flex items-center gap-4 rounded-xl bg-white/3 p-5"><TrendingUp className="size-6 shrink-0 text-muted-foreground" /><p className="text-sm leading-6 text-muted-foreground">Ainda não há receita neste período. O gráfico aparece conforme os atendimentos e as vendas são registrados.</p></div>}</CardContent></Card>
        <Card className="dashboard-card"><CardHeader><CardTitle className="font-heading text-lg">Resultados registrados</CardTitle><CardDescription>Sinais, fila de espera e campanhas.</CardDescription></CardHeader><CardContent><p className="font-heading mb-4 text-3xl font-semibold tracking-tight">{euro(data.impact.total)}</p>{[["Sinais", data.impact.deposits], ["Fila de espera", data.impact.waitlist], ["Campanhas", data.impact.campaigns]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between border-t border-white/8 py-2.5 text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono">{euro(Number(value))}</span></div>)}</CardContent></Card>
      </section> : null}
      {canViewInsights ? <section className="grid gap-3 md:grid-cols-2" aria-label="Lembretes da operação">{data.insights.map((insight) => <div key={insight.title} className="flex gap-3 rounded-xl border border-white/8 p-4"><span className="mt-0.5 text-muted-foreground">{insight.kind === "warning" ? <CircleAlert className="size-4" /> : <Scissors className="size-4" />}</span><div><p className="text-sm font-medium">{insight.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.detail}</p></div></div>)}</section> : null}
    </div>
  );
}
