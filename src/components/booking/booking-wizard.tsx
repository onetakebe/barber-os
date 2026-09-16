"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Clock, Crown, Eye, ShieldCheck, Sparkles, Scissors, Star, UserRound, Users, Zap, type LucideIcon } from "lucide-react";

import { createPublicBookingAction, type BookingActionState } from "@/app/(public)/barbearia/[slug]/agendar/actions";
import { MonthCalendar, type CalendarDay } from "@/components/booking/month-calendar";
import { StaffAvatar } from "@/components/staff-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type BookingCatalog = {
  business: { name: string; slug: string; timezone: string; currency: string; defaultDepositCents: number; cancellationNoticeHours: number };
  services: { id: string; name: string; description: string | null; priceCents: number; durationMinutes: number; depositRequired: boolean; isCombo: boolean }[];
  staff: { id: string; displayName: string; title: string | null; imageUrl: string | null; rating: number | null; reviewCount: number; serviceIds: string[] }[];
  /** Janela da reserva no fuso da barbearia: hoje e o último dia marcável. */
  window: { today: string; last: string };
  /** Entrada `?servico=id` da página pública: pré-seleciona um serviço. */
  initialServiceId?: string;
  initialStaffId?: string;
};

type Slot = { time: string; startsAt: string; endsAt: string; staffIds: string[] };
const steps = ["Serviço e profissional", "Dia e horário", "Seus dados"];
const dayLabel = (date: string) => date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00.000Z`)).replace(".", "") : "";
const initialState: BookingActionState = { status: "idle" };
const money = (cents: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
const dateTimeLabel = (iso: string, timezone: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(".", "");

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

/** Ícone decorativo por tipo de serviço — só pelo nome, não há categoria no catálogo público. */
function serviceIcon(service: { name: string; isCombo: boolean }): LucideIcon {
  const name = service.name.toLowerCase();
  if (service.isCombo) return Crown;
  if (name.includes("sobrancelha")) return Eye;
  if (name.includes("máquina") || name.includes("maquina")) return Zap;
  if (name.includes("barba")) return Sparkles;
  return Scissors;
}

/** Um barbeiro só faz a reserva inteira: precisa estar habilitado em todos os serviços escolhidos. */
function doesAll(member: { serviceIds: string[] }, serviceIds: string[]) {
  return serviceIds.every((id) => member.serviceIds.includes(id));
}

/** `?servico=` pré-seleciona um serviço; sem ele a seleção começa vazia. O profissional da URL
 *  só vale se fizer esse serviço. */
function initialSelection(catalog: BookingCatalog) {
  const serviceIds = catalog.services.some((item) => item.id === catalog.initialServiceId) ? [catalog.initialServiceId!] : [];
  const staff = catalog.staff.find((item) => item.id === catalog.initialStaffId);
  return { serviceIds, staffId: staff && doesAll(staff, serviceIds) ? staff.id : "any" };
}

export function BookingWizard({ catalog }: { catalog: BookingCatalog }) {
  const [step, setStep] = useState(0);
  const [serviceIds, setServiceIds] = useState(() => initialSelection(catalog).serviceIds);
  const [staffId, setStaffId] = useState(() => initialSelection(catalog).staffId);
  const [month, setMonth] = useState(catalog.window.today.slice(0, 7));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [monthError, setMonthError] = useState<string>();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [policy, setPolicy] = useState(true);
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [isLoadingMonth, startLoadingMonth] = useTransition();
  const [state, action, pending] = useActionState(createPublicBookingAction, initialState);
  // Itens na ordem do catálogo, independente da ordem em que foram marcados.
  const selectedServices = useMemo(() => catalog.services.filter((item) => serviceIds.includes(item.id)), [catalog.services, serviceIds]);
  const totalMinutes = selectedServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  const totalCents = selectedServices.reduce((sum, item) => sum + item.priceCents, 0);
  const serviceNames = selectedServices.map((item) => item.name).join(" + ");
  const price = (cents: number) => money(cents, catalog.business.currency);
  // Combos primeiro e em largura total: é o card "mais completo" da grade.
  const orderedServices = useMemo(() => [...catalog.services].sort((a, b) => Number(b.isCombo) - Number(a.isCombo)), [catalog.services]);
  // Interseção das habilitações; "qualquer profissional" também exige alguém que faça todos.
  const eligibleStaff = useMemo(() => catalog.staff.filter((member) => doesAll(member, serviceIds)), [catalog.staff, serviceIds]);
  const selectedStaff = eligibleStaff.find((item) => item.id === staffId);
  const selectedSlot = slots.find((item) => item.time === time);
  const selectionReady = selectedServices.length > 0 && eligibleStaff.length > 0;

  function toggleService(id: string) {
    const next = serviceIds.includes(id) ? serviceIds.filter((item) => item !== id) : [...serviceIds, id];
    setServiceIds(next);
    // O profissional já escolhido pode não fazer o serviço recém-incluído: volta para "qualquer".
    if (staffId !== "any" && !catalog.staff.some((member) => member.id === staffId && doesAll(member, next))) setStaffId("any");
  }

  /** Mesma seleção nas duas rotas de disponibilidade: um `serviceIds` por serviço. */
  function selectionQuery(extra: Record<string, string>) {
    const query = new URLSearchParams({ ...extra, staffId });
    for (const item of selectedServices) query.append("serviceIds", item.id);
    return query;
  }

  async function loadAvailability(nextDate = date) {
    setAvailabilityError(undefined);
    if (!nextDate) {
      setSlots([]);
      setTime("");
      return;
    }
    try {
      const response = await fetch(`/api/public/${catalog.business.slug}/availability?${selectionQuery({ date: nextDate })}`);
      if (!response.ok) throw new Error("AVAILABILITY_FAILED");
      const payload = await response.json() as { slots: Slot[] };
      setSlots(payload.slots);
      setTime(payload.slots[0]?.time ?? "");
    } catch {
      setSlots([]);
      setTime("");
      setAvailabilityError("Não foi possível carregar os horários. Tente novamente.");
    }
  }

  /** Carrega os dias do mês; devolve o primeiro dia livre (ou "" se não houver). */
  async function loadMonth(nextMonth = month) {
    setMonthError(undefined);
    try {
      const response = await fetch(`/api/public/${catalog.business.slug}/availability/month?${selectionQuery({ month: nextMonth })}`);
      if (!response.ok) throw new Error("MONTH_FAILED");
      const payload = await response.json() as { days: CalendarDay[] };
      setDays(payload.days);
      return payload.days.find((day) => day.available)?.date ?? "";
    } catch {
      setDays([]);
      setMonthError("Não foi possível carregar o mês. Tente novamente.");
      return "";
    }
  }

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    startLoadingMonth(async () => {
      const firstFree = await loadMonth(nextMonth);
      setDate(firstFree);
      await loadAvailability(firstFree);
    });
  }

  function next() {
    if (step === 0) {
      // Serviço/profissional podem ter mudado: recalcular o mês e cair no primeiro dia livre.
      startLoadingSlots(async () => {
        const startMonth = catalog.window.today.slice(0, 7);
        setMonth(startMonth);
        const firstFree = await loadMonth(startMonth);
        setDate(firstFree);
        await loadAvailability(firstFree);
        setStep(1);
      });
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  const detailsReady = Boolean(firstName && lastName && email && phone && policy);
  const lastStep = step === steps.length - 1;

  if (state.status === "success" && state.booking) {
    const booking = state.booking;
    return (
      <Card className="panel-glow mx-auto max-w-xl border-white/20 bg-white/[.04]">
        <CardContent className="flex flex-col items-center p-8 text-center sm:p-12">
          <div className="grid size-16 place-items-center rounded-full bg-brand text-brand-ink"><Check className="size-7" /></div>
          <Badge className="mt-6">Reserva confirmada</Badge>
          <h1 className="font-heading mt-4 text-3xl font-semibold">Sua cadeira está reservada.</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{dateTimeLabel(booking.startsAt, catalog.business.timezone)} com {booking.staffName}. Código {booking.appointmentId.slice(0, 8)}.</p>
          <div className="mt-7 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
            <ul className="flex flex-col gap-2 text-sm">{booking.services.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.name}</span><span className="text-muted-foreground">{item.durationMinutes} min · {money(item.priceCents, booking.currency)}</span></li>)}</ul>
            <Separator className="my-3" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>Duração total</span><span>{booking.durationMinutes} min</span></div>
            <div className="mt-2 flex justify-between font-medium"><span>Total a pagar na barbearia</span><span>{money(booking.totalCents, booking.currency)}</span></div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Nada foi cobrado agora. Para cancelar, avise com {booking.cancellationNoticeHours}h de antecedência.</p>
          <Button asChild className="mt-7 w-full"><Link href={`/barbearia/${catalog.business.slug}`}>Voltar à barbearia</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (catalog.services.length === 0) return <Card><CardContent className="p-8 text-center">Nenhum serviço está disponível para reserva.</CardContent></Card>;

  return (
    <form action={action} className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="slug" value={catalog.business.slug} />
      {selectedServices.map((item) => <input key={item.id} type="hidden" name="serviceIds" value={item.id} />)}
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="firstName" value={firstName} />
      <input type="hidden" name="lastName" value={lastName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="policy" value={policy ? "on" : ""} />
      <Card className="dashboard-card">
        <CardHeader className="border-b border-white/8"><div className="flex items-center justify-between"><div><CardTitle className="font-heading text-2xl">{steps[step]}</CardTitle><CardDescription>Passo {step + 1} de {steps.length}</CardDescription></div><span className="font-mono text-xs text-muted-foreground">{Math.round(((step + 1) / steps.length) * 100)}%</span></div><Progress value={((step + 1) / steps.length) * 100} className="mt-3 h-1 [&>div]:bg-brand" /></CardHeader>
        <CardContent className="p-5 sm:p-7">
          {step === 0 ? (
            <div className="flex flex-col gap-7">
              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">Serviços · escolha um ou mais</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {orderedServices.map((item) => {
                    const Icon = serviceIcon(item);
                    const professionals = catalog.staff.filter((member) => member.serviceIds.includes(item.id)).length;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleService(item.id)}
                        aria-pressed={serviceIds.includes(item.id)}
                        className={cn("choice-card flex flex-col p-5 text-left", item.isCombo && "choice-card--featured sm:col-span-2")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="icon-tile size-11"><Icon className="size-5" aria-hidden="true" /></span>
                          <span className="font-heading text-xl font-semibold tracking-tight">{price(item.priceCents)}</span>
                        </div>
                        <p className="font-heading mt-5 text-lg font-semibold leading-tight">{item.name}</p>
                        {item.description ? <p className={cn("choice-muted mt-1.5 text-sm leading-5", item.isCombo && "sm:max-w-md")}>{item.description}</p> : null}
                        <div className="mt-auto flex flex-wrap gap-2 pt-5 font-mono text-[11px]">
                          <span className="choice-chip inline-flex items-center gap-1.5 px-2.5 py-1"><Clock className="size-3" aria-hidden="true" />{item.durationMinutes} min</span>
                          <span className="choice-chip inline-flex items-center gap-1.5 px-2.5 py-1"><Users className="size-3" aria-hidden="true" />{professionals} {professionals === 1 ? "profissional" : "profissionais"}</span>
                          {item.isCombo ? <span className="choice-chip inline-flex items-center gap-1.5 px-2.5 py-1">Combo</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">Profissional</p>
                {eligibleStaff.length === 0 ? <p className="rounded-xl border border-white/10 p-4 text-sm text-muted-foreground">Nenhum profissional faz todos esses serviços na mesma visita. Ajuste a seleção.</p> : <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setStaffId("any")} aria-pressed={staffId === "any"} className="choice-card flex items-start gap-4 p-4 text-left">
                    <span className="icon-tile size-12 shrink-0"><UserRound className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block font-medium">Qualquer profissional</span><span className="choice-muted mt-1 block text-xs leading-5">O primeiro disponível para este horário.</span></span>
                  </button>
                  {eligibleStaff.map((member) => (
                    <button type="button" key={member.id} onClick={() => setStaffId(member.id)} aria-pressed={staffId === member.id} className="choice-card flex items-start gap-4 p-4 text-left">
                      <StaffAvatar imageUrl={member.imageUrl} initials={initials(member.displayName)} className="size-12" />
                      <span className="min-w-0">
                        <span className="block font-medium">{member.displayName}</span>
                        <span className="choice-muted mt-1 block text-xs">{member.title ?? "Profissional"}</span>
                        {member.rating ? <span className="mt-2 flex items-center gap-1 font-mono text-[11px]"><Star className="size-3 fill-current" aria-hidden="true" />{member.rating.toFixed(1)}<span className="choice-muted">· {member.reviewCount}</span></span> : <span className="choice-muted mt-2 block font-mono text-[11px]">Sem avaliações</span>}
                      </span>
                    </button>
                  ))}
                </div>}
              </div>
            </div>
          ) : null}
          {step === 1 ? <div className="flex flex-col gap-6"><div><p className="mb-3 text-xs font-medium text-muted-foreground">Escolha o dia</p>{monthError ? <p className="rounded-xl border border-white/10 p-4 text-sm text-muted-foreground">{monthError}</p> : <MonthCalendar month={month} days={days} selected={date} minMonth={catalog.window.today.slice(0, 7)} maxMonth={catalog.window.last.slice(0, 7)} loading={isLoadingMonth} onMonthChange={changeMonth} onSelect={(value) => { setDate(value); startLoadingSlots(() => loadAvailability(value)); }} />}</div><div><p className="mb-3 text-xs font-medium text-muted-foreground">Horários disponíveis{date ? ` · ${dayLabel(date)}` : ""}</p>{isLoadingSlots || isLoadingMonth ? <p className="text-sm text-muted-foreground">Calculando disponibilidade...</p> : slots.length ? <ToggleGroup type="single" value={time} onValueChange={(value) => value && setTime(value)} className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((item) => <ToggleGroupItem key={item.time} value={item.time} className="font-mono data-[state=on]:bg-brand data-[state=on]:text-brand-ink">{item.time}</ToggleGroupItem>)}</ToggleGroup> : <p className="rounded-xl border border-white/10 p-4 text-sm text-muted-foreground">{availabilityError ?? (date ? "Nenhum horário disponível neste dia." : "Nenhum dia com horário livre neste mês.")}</p>}</div><div className="rounded-xl border border-primary/20 bg-primary/6 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline size-4 text-brand" /> Conferimos a disponibilidade do seu horário antes de confirmar.</div></div> : null}
          {step === 2 ? (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-white/8 bg-black/15 p-5"><div className="flex items-center gap-3"><div className="icon-tile size-10"><CalendarCheck /></div><div><p className="font-medium">{serviceNames} com {selectedStaff?.displayName ?? "o primeiro profissional disponível"}</p><p className="text-xs text-muted-foreground">{dayLabel(date)} às {time} · {totalMinutes} min</p></div></div><Separator className="my-4" /><div className="flex justify-between text-sm"><span>Total, pago na barbearia</span><span className="font-heading text-xl font-semibold">{price(totalCents)}</span></div><p className="mt-2 text-xs text-muted-foreground">Nada é cobrado agora. Para cancelar, avise com {catalog.business.cancellationNoticeHours}h de antecedência.</p></div>
              <FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="firstNameVisible">Nome</FieldLabel><Input id="firstNameVisible" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required /></Field><Field><FieldLabel htmlFor="lastNameVisible">Sobrenome</FieldLabel><Input id="lastNameVisible" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required /></Field></div><Field><FieldLabel htmlFor="bookingEmail">E-mail</FieldLabel><Input id="bookingEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></Field><Field><FieldLabel htmlFor="phoneVisible">Telefone</FieldLabel><Input id="phoneVisible" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required /></Field><Field orientation="horizontal"><Checkbox id="policyVisible" checked={policy} onCheckedChange={(value) => setPolicy(value === true)} /><FieldLabel htmlFor="policyVisible" className="font-normal">Aceito a política de cancelamento de {catalog.business.cancellationNoticeHours} horas.</FieldLabel></Field></FieldGroup>
              {state.message ? <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p> : null}
            </div>
          ) : null}
          <div className="mt-8 flex items-center justify-between"><Button type="button" variant="ghost" onClick={(event) => { event.preventDefault(); setStep((current) => Math.max(0, current - 1)); }} disabled={step === 0 || pending}><ArrowLeft data-icon="inline-start" /> Voltar</Button>{lastStep ? <Button key="submit-booking" type="submit" className="bg-brand text-brand-ink hover:bg-brand-deep hover:text-white" disabled={pending || !time || !detailsReady}>{pending ? "Confirmando..." : "Confirmar reserva"}<Check data-icon="inline-start" /></Button> : <Button key={`continue-${step}`} type="button" className="bg-brand text-brand-ink hover:bg-brand-deep hover:text-white" onClick={(event) => { event.preventDefault(); next(); }} disabled={isLoadingSlots || isLoadingMonth || (step === 0 && !selectionReady) || (step === 1 && (!time || !selectedSlot))}>Continuar <ArrowRight data-icon="inline-end" /></Button>}</div>
        </CardContent>
      </Card>
      <Card className="light-panel h-fit border-0 lg:sticky lg:top-5"><CardHeader><CardTitle className="font-heading text-base">Resumo da reserva</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><div><p className="text-xs text-muted-foreground">Serviços</p>{selectedServices.length ? <ul className="mt-1 flex flex-col gap-1">{selectedServices.map((item) => <li key={item.id} className="flex justify-between gap-3 text-sm"><span className="font-medium">{item.name}</span><span className="text-muted-foreground">{item.durationMinutes} min · {price(item.priceCents)}</span></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Escolha pelo menos um serviço.</p>}<p className="mt-1 text-xs text-muted-foreground">{totalMinutes} min no total</p></div><Separator /><div><p className="text-xs text-muted-foreground">Profissional</p><p className="mt-1 text-sm font-medium">{selectedStaff?.displayName ?? "Qualquer disponível"}</p></div><div><p className="text-xs text-muted-foreground">Data e horário</p><p className="mt-1 text-sm font-medium">{date ? `${dayLabel(date)} · ${time || "A escolher"}` : "A escolher"}</p></div><Separator /><div className="flex justify-between font-medium"><span>Total, pago na barbearia</span><span>{price(totalCents)}</span></div><div className="rounded-xl border border-black/10 bg-black/5 p-3 text-xs leading-5 text-foreground"><CalendarCheck className="mr-2 inline size-4" /> Confirmação imediata, sem cobrança online.</div></CardContent></Card>
    </form>
  );
}
