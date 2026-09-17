"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Clock, Crown, Eye, ShieldCheck, Sparkles, Scissors, Star, UserRound, Users, Zap, type LucideIcon } from "lucide-react";

import { createPublicBookingAction, type BookingActionState } from "@/app/(public)/barbearia/[slug]/agendar/actions";
import { dayLabel, money } from "@/components/booking/booking-format";
import { doesAll, initialSelection, toggleSelection } from "@/components/booking/booking-selection";
import { BookingSuccess } from "@/components/booking/booking-success";
import { BookingSummary } from "@/components/booking/booking-summary";
import { TimeWheelPicker } from "@/components/booking/time-wheel-picker";
import { MonthCalendar, type CalendarDay } from "@/components/booking/month-calendar";
import { StaffAvatar } from "@/components/staff-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
const initialState: BookingActionState = { status: "idle" };

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

export function BookingWizard({ catalog }: { catalog: BookingCatalog }) {
  const [step, setStep] = useState(0);
  // Serviços e profissional andam juntos: alternar um card pode invalidar o barbeiro escolhido.
  const [selection, setSelection] = useState(() => initialSelection(catalog));
  const { serviceIds, staffId } = selection;
  const [month, setMonth] = useState(catalog.window.today.slice(0, 7));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [monthError, setMonthError] = useState<string>();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string>();
  // Aviso de horário tomado (SLOT_CONFLICT); some quando o cliente escolhe outro dia ou horário.
  const [conflictNotice, setConflictNotice] = useState<string>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [policy, setPolicy] = useState(true);
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [isLoadingMonth, startLoadingMonth] = useTransition();
  // Consultas de mês e de dia em voo: só a mais recente vale. Trocar dia, mês, serviço ou
  // profissional depressa não pode trazer de volta os horários de uma consulta anterior.
  const scheduleRequest = useRef(0);
  const [state, action, pending] = useActionState(submitBooking, initialState);
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

  // Serviço ou profissional novo invalida dia e horário já escolhidos (e qualquer resposta em voo).
  const toggleService = (id: string) => { setSelection((current) => toggleSelection(current, id, catalog)); resetSchedule(); };
  const selectStaff = (id: string) => { setSelection((current) => ({ ...current, staffId: id })); resetSchedule(); };

  function nextRequest() {
    scheduleRequest.current += 1;
    return scheduleRequest.current;
  }

  function resetSchedule() {
    nextRequest();
    setDate("");
    clearSlots();
  }

  /** Dia novo (ou nenhum): o horário e a roda do dia anterior não ficam à mostra enquanto carrega. */
  function clearSlots() {
    setTime("");
    setSlots([]);
    setConflictNotice(undefined);
  }

  // A roda só entrega combinações dos `slots`, mas `time` nunca fica fora deles de qualquer forma.
  function changeTime(next: string) {
    if (!slots.some((slot) => slot.time === next)) return;
    setTime(next);
    setConflictNotice(undefined);
  }

  /** Mesma seleção nas duas rotas de disponibilidade: um `serviceIds` por serviço. */
  function selectionQuery(extra: Record<string, string>) {
    const query = new URLSearchParams({ ...extra, staffId });
    for (const item of selectedServices) query.append("serviceIds", item.id);
    return query;
  }

  /** Horários do dia; a seleção antiga não sobrevive: o primeiro horário do dia novo vira o escolhido.
   *  Resposta de uma consulta mais antiga que `request` é descartada. */
  async function loadAvailability(nextDate: string, request = nextRequest()) {
    setAvailabilityError(undefined);
    if (!nextDate) {
      clearSlots();
      return;
    }
    try {
      const response = await fetch(`/api/public/${catalog.business.slug}/availability?${selectionQuery({ date: nextDate })}`);
      if (!response.ok) throw new Error("AVAILABILITY_FAILED");
      const payload = await response.json() as { slots: Slot[] };
      if (request !== scheduleRequest.current) return;
      setSlots(payload.slots);
      setTime(payload.slots[0]?.time ?? "");
    } catch {
      if (request !== scheduleRequest.current) return;
      setSlots([]);
      setTime("");
      setAvailabilityError("Não foi possível carregar os horários. Tente novamente.");
    }
  }

  /** Carrega os dias do mês; devolve o primeiro dia livre ("" se não houver) ou `undefined` quando
   *  a resposta já ficou para trás — quem chamou não deve mexer em mais nada. */
  async function loadMonth(nextMonth: string, request = nextRequest()) {
    setMonthError(undefined);
    try {
      const response = await fetch(`/api/public/${catalog.business.slug}/availability/month?${selectionQuery({ month: nextMonth })}`);
      if (!response.ok) throw new Error("MONTH_FAILED");
      const payload = await response.json() as { days: CalendarDay[] };
      if (request !== scheduleRequest.current) return undefined;
      setDays(payload.days);
      return payload.days.find((day) => day.available)?.date ?? "";
    } catch {
      if (request !== scheduleRequest.current) return undefined;
      setDays([]);
      setMonthError("Não foi possível carregar o mês. Tente novamente.");
      return "";
    }
  }

  /** Mês novo: recarrega os dias e cai no primeiro livre, com os horários dele. Devolve `false`
   *  quando a consulta ficou para trás (outra seleção no meio do caminho). */
  async function loadMonthAndFirstDay(nextMonth: string, request = nextRequest()) {
    const firstFree = await loadMonth(nextMonth, request);
    if (firstFree === undefined) return false;
    setDate(firstFree);
    clearSlots();
    await loadAvailability(firstFree, request);
    return request === scheduleRequest.current;
  }

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    startLoadingMonth(async () => { await loadMonthAndFirstDay(nextMonth); });
  }

  function selectDate(nextDate: string) {
    setDate(nextDate);
    clearSlots();
    startLoadingSlots(() => loadAvailability(nextDate));
  }

  /** Outro cliente levou o horário entre a escolha e a confirmação: volta ao passo do horário com
   *  os dados pessoais intactos (o estado é controlado) e recalcula o dia e o mês. */
  async function submitBooking(previous: BookingActionState, formData: FormData) {
    const result = await createPublicBookingAction(previous, formData);
    if (result.code === "SLOT_CONFLICT") {
      setStep(1);
      setConflictNotice(result.message);
      const request = nextRequest();
      startLoadingSlots(async () => {
        await loadMonth(month, request);
        await loadAvailability(date, request);
      });
    }
    return result;
  }

  function next() {
    if (step === 0) {
      // Serviço/profissional podem ter mudado: recalcular o mês e cair no primeiro dia livre.
      const startMonth = catalog.window.today.slice(0, 7);
      setMonth(startMonth);
      startLoadingSlots(async () => {
        // Card trocado enquanto o mês carregava: a resposta foi descartada e o passo não avança.
        if (await loadMonthAndFirstDay(startMonth)) setStep(1);
      });
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  const detailsReady = Boolean(firstName && lastName && email && phone && policy);
  const lastStep = step === steps.length - 1;
  const isLoadingSchedule = isLoadingSlots || isLoadingMonth;

  if (state.status === "success" && state.booking) return <BookingSuccess booking={state.booking} business={catalog.business} />;

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
                        disabled={isLoadingSchedule}
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
                  <button type="button" onClick={() => selectStaff("any")} disabled={isLoadingSchedule} aria-pressed={staffId === "any"} className="choice-card flex items-start gap-4 p-4 text-left">
                    <span className="icon-tile size-12 shrink-0"><UserRound className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block font-medium">Qualquer profissional</span><span className="choice-muted mt-1 block text-xs leading-5">O primeiro disponível para este horário.</span></span>
                  </button>
                  {eligibleStaff.map((member) => (
                    <button type="button" key={member.id} onClick={() => selectStaff(member.id)} disabled={isLoadingSchedule} aria-pressed={staffId === member.id} className="choice-card flex items-start gap-4 p-4 text-left">
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
          {step === 1 ? (
            <div className="flex flex-col gap-6">
              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">Escolha o dia</p>
                {monthError ? <p className="rounded-xl border border-white/10 p-4 text-sm text-muted-foreground">{monthError}</p> : <MonthCalendar month={month} days={days} selected={date} minMonth={catalog.window.today.slice(0, 7)} maxMonth={catalog.window.last.slice(0, 7)} loading={isLoadingMonth} onMonthChange={changeMonth} onSelect={selectDate} />}
              </div>
              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">Horário{date ? ` · ${dayLabel(date)}` : ""}{isLoadingSchedule ? " · calculando disponibilidade..." : ""}</p>
                {slots.length ? (
                  <TimeWheelPicker slots={slots} value={time} onChange={changeTime} disabled={isLoadingSchedule} />
                ) : isLoadingSchedule ? (
                  <p className="text-sm text-muted-foreground">Calculando disponibilidade...</p>
                ) : (
                  <p className="rounded-xl border border-white/10 p-4 text-sm text-muted-foreground">{availabilityError ?? (date ? "Nenhum horário disponível neste dia." : "Nenhum dia com horário livre neste mês.")}</p>
                )}
                {conflictNotice ? <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{conflictNotice}</p> : null}
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/6 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline size-4 text-brand" /> Conferimos a disponibilidade do seu horário antes de confirmar.</div>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-white/8 bg-black/15 p-5"><div className="flex items-center gap-3"><div className="icon-tile size-10"><CalendarCheck /></div><div><p className="font-medium">{serviceNames} com {selectedStaff?.displayName ?? "o primeiro profissional disponível"}</p><p className="text-xs text-muted-foreground">{dayLabel(date)} às {time} · {totalMinutes} min</p></div></div><Separator className="my-4" /><div className="flex justify-between text-sm"><span>Total, pago na barbearia</span><span className="font-heading text-xl font-semibold">{price(totalCents)}</span></div><p className="mt-2 text-xs text-muted-foreground">Nada é cobrado agora. Para cancelar, avise com {catalog.business.cancellationNoticeHours}h de antecedência.</p></div>
              <FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="firstNameVisible">Nome</FieldLabel><Input id="firstNameVisible" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required /></Field><Field><FieldLabel htmlFor="lastNameVisible">Sobrenome</FieldLabel><Input id="lastNameVisible" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required /></Field></div><Field><FieldLabel htmlFor="bookingEmail">E-mail</FieldLabel><Input id="bookingEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></Field><Field><FieldLabel htmlFor="phoneVisible">Telefone</FieldLabel><Input id="phoneVisible" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required /></Field><Field orientation="horizontal"><Checkbox id="policyVisible" checked={policy} onCheckedChange={(value) => setPolicy(value === true)} /><FieldLabel htmlFor="policyVisible" className="font-normal">Aceito a política de cancelamento de {catalog.business.cancellationNoticeHours} horas.</FieldLabel></Field></FieldGroup>
              {state.message && state.code !== "SLOT_CONFLICT" ? <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p> : null}
            </div>
          ) : null}
          <div className="mt-8 flex items-center justify-between"><Button type="button" variant="ghost" onClick={(event) => { event.preventDefault(); setStep((current) => Math.max(0, current - 1)); }} disabled={step === 0 || pending}><ArrowLeft data-icon="inline-start" /> Voltar</Button>{lastStep ? <Button key="submit-booking" type="submit" className="bg-brand text-brand-ink hover:bg-brand-deep hover:text-white" disabled={pending || !time || !detailsReady}>{pending ? "Confirmando..." : "Confirmar reserva"}<Check data-icon="inline-start" /></Button> : <Button key={`continue-${step}`} type="button" className="bg-brand text-brand-ink hover:bg-brand-deep hover:text-white" onClick={(event) => { event.preventDefault(); next(); }} disabled={isLoadingSchedule || (step === 0 && !selectionReady) || (step === 1 && (!time || !selectedSlot))}>Continuar <ArrowRight data-icon="inline-end" /></Button>}</div>
        </CardContent>
      </Card>
      <BookingSummary services={selectedServices} totalMinutes={totalMinutes} totalCents={totalCents} currency={catalog.business.currency} staffName={selectedStaff?.displayName} date={date} time={time} />
    </form>
  );
}
