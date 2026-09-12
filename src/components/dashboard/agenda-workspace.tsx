"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Scissors } from "lucide-react";

import { AppointmentCancelButton } from "@/components/dashboard/appointment-actions";
import { AppointmentCreateDialog } from "@/components/dashboard/appointment-create-dialog";
import { AvailabilityManager } from "@/components/dashboard/availability-manager";
import { StaffAvatar } from "@/components/staff-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string; dateKey: string; staffId: string; startMinute: number; endMinute: number;
  time: string; end: string; customer: string; service: string; staff: string;
  staffInitials: string; status: string; onGrid: boolean; cancellable: boolean;
};
type Staff = { id: string; name: string; initials: string; color: string; imageUrl: string | null };
type Service = { id: string; name: string; durationMinutes: number; priceCents: number };
type Day = { value: string; label: string };
type AvailabilityManagement = {
  staff: { id: string; name: string }[];
  availability: { id: string; staffName: string; dayOfWeek: number; hours: string; breakHours: string }[];
  timeOff: { id: string; staffName: string; period: string; reason: string }[];
};

/** 30 min = 45px. Bloco proporcional à duração é o que faz a grade ler como agenda; 45px
 *  também mantém a faixa clicável acima do alvo mínimo de 44px. */
const PX_PER_MINUTE = 1.5;
const SLOT_MINUTES = 30;

const statusLabel: Record<string, string> = {
  PENDING: "A confirmar", CONFIRMED: "Confirmado", CHECKED_IN: "Chegou",
  IN_PROGRESS: "Em atendimento", COMPLETED: "Concluído",
  CANCELLED_BY_CUSTOMER: "Cancelado pelo cliente", CANCELLED_BY_BUSINESS: "Cancelado",
  NO_SHOW: "Faltou",
};

function clockLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function AgendaWorkspace({
  appointments, staff, services, days, todayValue, dayStartMinute, dayEndMinute,
  timezone, tenantSlug, canEdit, availabilityManagement,
}: {
  appointments: Appointment[]; staff: Staff[]; services: Service[]; days: Day[];
  todayValue: string; dayStartMinute: number; dayEndMinute: number;
  timezone: string; tenantSlug: string; canEdit: boolean;
  availabilityManagement?: AvailabilityManagement;
}) {
  const [dayIndex, setDayIndex] = useState(0);
  const [prefill, setPrefill] = useState<{ staffId: string; date: string; time: string } | null>(null);
  const [nowMinute, setNowMinute] = useState<number | null>(null);
  const day = days[dayIndex];

  // Só no cliente: o marcador de "agora" depende do relógio e quebraria a hidratação.
  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
      const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
      setNowMinute(hour * 60 + minute);
    };
    read();
    const timer = setInterval(read, 60_000);
    return () => clearInterval(timer);
  }, [timezone]);

  const visible = useMemo(() => appointments.filter((item) => item.dateKey === day?.value), [appointments, day]);
  const onGrid = visible.filter((item) => item.onGrid);
  const offGrid = visible.filter((item) => !item.onGrid);

  const spanMinutes = Math.max(60, dayEndMinute - dayStartMinute);
  const bodyHeight = spanMinutes * PX_PER_MINUTE;
  const slotCount = Math.ceil(spanMinutes / SLOT_MINUTES);
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let minute = Math.ceil(dayStartMinute / 60) * 60; minute <= dayEndMinute; minute += 60) marks.push(minute);
    return marks;
  }, [dayStartMinute, dayEndMinute]);

  const showNow = day?.value === todayValue && nowMinute !== null && nowMinute >= dayStartMinute && nowMinute <= dayEndMinute;
  const gridTemplate = `64px repeat(${Math.max(1, staff.length)}, minmax(160px, 1fr))`;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-primary">Operação persistida</p>
          <h1 className="font-heading text-3xl font-semibold tracking-[-.035em]">Agenda</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {clockLabel(dayStartMinute)} às {clockLabel(dayEndMinute)} · {onGrid.length} {onGrid.length === 1 ? "reserva" : "reservas"} neste dia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => setDayIndex((current) => Math.max(0, current - 1))} disabled={dayIndex === 0}>
            <ChevronLeft /><span className="sr-only">Dia anterior</span>
          </Button>
          <Badge variant="outline" className="h-9 min-w-36 justify-center">{day?.label}</Badge>
          <Button type="button" variant="outline" size="icon" onClick={() => setDayIndex((current) => Math.min(days.length - 1, current + 1))} disabled={dayIndex === days.length - 1}>
            <ChevronRight /><span className="sr-only">Próximo dia</span>
          </Button>
          {canEdit ? (
            <AppointmentCreateDialog
              services={services}
              staff={staff}
              days={days}
              tenantSlug={tenantSlug}
              defaultDate={day?.value ?? todayValue}
              prefill={prefill}
              onOpenChange={(open) => { if (!open) setPrefill(null); }}
            />
          ) : null}
        </div>
      </section>

      {staff.length === 0 ? (
        <p className="border border-white/10 p-12 text-center text-sm text-muted-foreground">
          Nenhum profissional com agenda aberta. Cadastre a equipe para usar a grade.
        </p>
      ) : (
        <section aria-label={`Grade da agenda — ${day?.label}`} className="overflow-x-auto border border-white/12 bg-surface-panel">
          <div className="min-w-[640px]">
            {/* Cabeçalho: uma coluna por profissional */}
            <div className="grid border-b border-white/12 bg-surface-panel" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="border-r border-white/12 px-2 py-3 text-[10px] uppercase tracking-[.16em] text-muted-foreground">Hora</div>
              {staff.map((member) => (
                <div key={member.id} className="flex items-center gap-2 border-r border-white/12 px-3 py-3 last:border-r-0">
                  <StaffAvatar imageUrl={member.imageUrl} initials={member.initials} color={member.color} className="size-7" />
                  <span className="truncate text-xs font-medium">{member.name}</span>
                </div>
              ))}
            </div>

            {/* Corpo: eixo de tempo + colunas posicionadas */}
            <div className="relative grid" style={{ gridTemplateColumns: gridTemplate, height: bodyHeight }}>
              <div className="relative border-r border-white/12">
                {hourMarks.map((minute) => {
                  const top = (minute - dayStartMinute) * PX_PER_MINUTE;
                  // O primeiro rótulo cai em top:0; centralizá-lo cortaria metade fora da grade.
                  return (
                    <span
                      key={minute}
                      className={cn("absolute right-2 font-mono text-[10px] text-muted-foreground", top > 0 && "-translate-y-1/2")}
                      style={{ top }}
                    >
                      {clockLabel(minute)}
                    </span>
                  );
                })}
              </div>

              {staff.map((member) => {
                const blocks = onGrid.filter((item) => item.staffId === member.id);
                return (
                  <div
                    key={member.id}
                    className="relative border-r border-white/12 last:border-r-0"
                    style={{
                      backgroundImage: `repeating-linear-gradient(to bottom, oklch(1 0 0 / 9%) 0 1px, transparent 1px ${60 * PX_PER_MINUTE}px)`,
                    }}
                  >
                    {/* Camada de fundo clicável: cada faixa de 30 min é um botão real,
                        então marcar por clique também funciona no teclado e tem nome acessível. */}
                    {canEdit
                      ? Array.from({ length: slotCount }, (_, index) => {
                          const minute = dayStartMinute + index * SLOT_MINUTES;
                          const busy = blocks.some((item) => item.startMinute < minute + SLOT_MINUTES && item.endMinute > minute);
                          if (busy) return null;
                          return (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => setPrefill({ staffId: member.id, date: day.value, time: clockLabel(minute) })}
                              className="absolute inset-x-0 z-0 cursor-pointer transition-colors hover:bg-white/[.05] focus-visible:bg-white/[.07] focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-white/50"
                              style={{ top: (minute - dayStartMinute) * PX_PER_MINUTE, height: SLOT_MINUTES * PX_PER_MINUTE }}
                            >
                              <span className="sr-only">Marcar às {clockLabel(minute)} com {member.name}</span>
                            </button>
                          );
                        })
                      : null}

                    {blocks.map((item) => {
                      const height = Math.max(22, (item.endMinute - item.startMinute) * PX_PER_MINUTE);
                      return (
                        <article
                          key={item.id}
                          className="absolute inset-x-1 z-10 overflow-hidden border border-white/12 bg-surface-raised px-2 py-1.5"
                          style={{ top: (item.startMinute - dayStartMinute) * PX_PER_MINUTE, height, borderLeft: `3px solid ${member.color}` }}
                        >
                          <p className="font-mono text-[10px] text-muted-foreground">{item.time}–{item.end}</p>
                          <p className="truncate text-xs font-medium">{item.customer}</p>
                          {height >= 54 ? <p className="truncate text-[11px] text-muted-foreground">{item.service}</p> : null}
                          {height >= 76 ? <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-muted-foreground">{statusLabel[item.status] ?? item.status}</p> : null}
                        </article>
                      );
                    })}
                  </div>
                );
              })}

              {showNow ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-30 border-t border-primary"
                  style={{ top: (nowMinute! - dayStartMinute) * PX_PER_MINUTE }}
                >
                  <span className="absolute left-0 -translate-y-1/2 bg-primary px-1 font-mono text-[9px] text-primary-foreground">{clockLabel(nowMinute!)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {onGrid.length === 0 && staff.length > 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma reserva ativa neste dia. Clique numa faixa livre da grade para marcar.</p>
      ) : null}

      {/* Fora da grade: cancelados e faltas continuam visíveis, sem ocupar espaço no eixo. */}
      {offGrid.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-[.16em] text-muted-foreground">Fora da grade ({offGrid.length})</h2>
          {offGrid.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border border-white/10 px-4 py-3">
              <span className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{item.time}</span>
                <span className="line-through decoration-white/40">{item.customer}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Scissors className="size-3" />{item.service}</span>
              </span>
              <Badge variant="outline">{statusLabel[item.status] ?? item.status}</Badge>
            </div>
          ))}
        </section>
      ) : null}

      {canEdit && onGrid.some((item) => item.cancellable) ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-[.16em] text-muted-foreground">Cancelar reserva</h2>
          <div className="flex flex-col gap-2">
            {onGrid.filter((item) => item.cancellable).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border border-white/10 px-4 py-3">
                <span className="text-sm"><span className="font-mono text-xs text-muted-foreground">{item.time}</span> · {item.customer} · <span className="text-muted-foreground">{item.staff}</span></span>
                <AppointmentCancelButton appointmentId={item.id} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {availabilityManagement ? <AvailabilityManager {...availabilityManagement} /> : null}
    </div>
  );
}
