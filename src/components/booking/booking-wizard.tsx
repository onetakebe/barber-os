"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, CreditCard, ShieldCheck, Star, UserRound } from "lucide-react";

import { createPublicBookingAction, type BookingActionState } from "@/app/(public)/barbearia/[slug]/agendar/actions";
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
  business: { name: string; slug: string; timezone: string; defaultDepositCents: number; cancellationNoticeHours: number };
  services: { id: string; name: string; description: string | null; priceCents: number; durationMinutes: number; depositRequired: boolean }[];
  staff: { id: string; displayName: string; title: string | null; imageUrl: string | null; rating: number | null; reviewCount: number; serviceIds: string[] }[];
  dates: { value: string; label: string }[];
  initialServiceId?: string;
  initialStaffId?: string;
};

type Slot = { time: string; startsAt: string; endsAt: string; staffIds: string[] };
const steps = ["Serviço", "Profissional", "Horário", "Seus dados", "Sinal"];
const initialState: BookingActionState = { status: "idle" };
const euro = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(cents / 100);

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

export function BookingWizard({ catalog }: { catalog: BookingCatalog }) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(catalog.services.some((item) => item.id === catalog.initialServiceId) ? catalog.initialServiceId! : catalog.services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(catalog.staff.some((item) => item.id === catalog.initialStaffId) ? catalog.initialStaffId! : "any");
  const [date, setDate] = useState(catalog.dates[0]?.value ?? "");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [policy, setPolicy] = useState(true);
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [state, action, pending] = useActionState(createPublicBookingAction, initialState);
  const service = useMemo(() => catalog.services.find((item) => item.id === serviceId) ?? catalog.services[0], [catalog.services, serviceId]);
  const eligibleStaff = useMemo(() => catalog.staff.filter((member) => member.serviceIds.includes(serviceId)), [catalog.staff, serviceId]);
  const selectedStaff = eligibleStaff.find((item) => item.id === staffId);
  const selectedSlot = slots.find((item) => item.time === time);
  const depositCents = service?.depositRequired ? Math.min(catalog.business.defaultDepositCents, service.priceCents) : 0;

  async function loadAvailability(nextDate = date) {
    setAvailabilityError(undefined);
    const query = new URLSearchParams({ date: nextDate, serviceId, staffId });
    try {
      const response = await fetch(`/api/public/${catalog.business.slug}/availability?${query}`);
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

  function next() {
    if (step === 1) {
      startLoadingSlots(async () => {
        await loadAvailability();
        setStep(2);
      });
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  if (state.status === "success" && state.booking) {
    return (
      <Card className="panel-glow mx-auto max-w-xl border-white/20 bg-white/[.04]">
        <CardContent className="flex flex-col items-center p-8 text-center sm:p-12">
          <div className="grid size-16 place-items-center rounded-full bg-white text-black"><Check className="size-7" /></div>
          <Badge className="mt-6">Reserva persistida</Badge>
          <h1 className="font-heading mt-4 text-3xl font-semibold">Sua cadeira está reservada.</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{state.booking.serviceName} com {state.booking.staffName}. Código {state.booking.appointmentId.slice(0, 8)}.</p>
          <div className="mt-7 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left"><div className="flex justify-between text-sm"><span>Total</span><span>{euro(state.booking.totalCents)}</span></div><div className="mt-2 flex justify-between text-sm text-white"><span>Sinal simulado pago</span><span>− {euro(state.booking.depositCents)}</span></div><Separator className="my-3" /><div className="flex justify-between font-medium"><span>Saldo no local</span><span>{euro(state.booking.totalCents - state.booking.depositCents)}</span></div></div>
          <p className="mt-4 text-xs text-muted-foreground">Cancelando com {state.booking.cancellationNoticeHours}h de antecedência, o sinal vira crédito.</p>
          <Button asChild className="mt-7 w-full"><Link href={`/barbearia/${catalog.business.slug}`}>Voltar à barbearia</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (!service) return <Card><CardContent className="p-8 text-center">Nenhum serviço está disponível para reserva.</CardContent></Card>;

  return (
    <form action={action} className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="slug" value={catalog.business.slug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="firstName" value={firstName} />
      <input type="hidden" name="lastName" value={lastName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="policy" value={policy ? "on" : ""} />
      <Card className="panel-glow border-white/10">
        <CardHeader className="border-b border-white/8"><div className="flex items-center justify-between"><div><CardTitle className="font-heading text-2xl">{steps[step]}</CardTitle><CardDescription>Passo {step + 1} de {steps.length}</CardDescription></div><span className="font-mono text-xs text-muted-foreground">{Math.round(((step + 1) / steps.length) * 100)}%</span></div><Progress value={((step + 1) / steps.length) * 100} className="mt-3 h-1" /></CardHeader>
        <CardContent className="p-5 sm:p-7">
          {step === 0 ? <div className="grid gap-3">{catalog.services.map((item) => <button type="button" key={item.id} onClick={() => { setServiceId(item.id); setStaffId("any"); }} className={cn("flex items-center justify-between rounded-2xl border p-4 text-left transition-colors", serviceId === item.id ? "border-primary/50 bg-primary/8" : "border-white/8 hover:bg-white/[.025]")}><div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.description ?? "Serviço profissional"}</p><p className="mt-2 font-mono text-[11px] text-muted-foreground">{item.durationMinutes} min</p></div><span className="font-heading text-lg font-semibold">{euro(item.priceCents)}</span></button>)}</div> : null}
          {step === 1 ? <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setStaffId("any")} className={cn("flex items-start gap-4 rounded-2xl border p-4 text-left", staffId === "any" ? "border-primary/50 bg-primary/8" : "border-white/8")}><span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 text-white"><UserRound className="size-5" /></span><span className="min-w-0"><span className="block font-medium">Qualquer profissional</span><span className="mt-1 block text-xs text-muted-foreground">O primeiro disponível para este horário.</span></span></button>{eligibleStaff.map((member) => <button type="button" key={member.id} onClick={() => setStaffId(member.id)} className={cn("flex items-start gap-4 rounded-2xl border p-4 text-left", staffId === member.id ? "border-primary/50 bg-primary/8" : "border-white/8")}><StaffAvatar imageUrl={member.imageUrl} initials={initials(member.displayName)} className="size-12" /><span className="min-w-0"><span className="block font-medium">{member.displayName}</span><span className="mt-1 block text-xs text-muted-foreground">{member.title ?? "Profissional"}</span>{member.rating ? <span className="mt-2 flex items-center gap-1 font-mono text-[11px]"><Star className="size-3 fill-current" aria-hidden="true" />{member.rating.toFixed(1)}<span className="text-muted-foreground">· {member.reviewCount}</span></span> : <span className="mt-2 block font-mono text-[11px] text-muted-foreground">Sem avaliações</span>}</span></button>)}</div> : null}
          {step === 2 ? <div className="flex flex-col gap-6"><div><p className="mb-3 text-xs font-medium text-muted-foreground">Escolha o dia</p><ToggleGroup type="single" value={date} onValueChange={(value) => { if (!value) return; setDate(value); startLoadingSlots(() => loadAvailability(value)); }} className="grid grid-cols-2 gap-2 sm:grid-cols-4">{catalog.dates.map((item) => <ToggleGroupItem key={item.value} value={item.value} className="h-12">{item.label}</ToggleGroupItem>)}</ToggleGroup></div><div><p className="mb-3 text-xs font-medium text-muted-foreground">Horários disponíveis</p>{isLoadingSlots ? <p className="text-sm text-muted-foreground">Calculando disponibilidade...</p> : slots.length ? <ToggleGroup type="single" value={time} onValueChange={(value) => value && setTime(value)} className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((item) => <ToggleGroupItem key={item.time} value={item.time} className="font-mono">{item.time}</ToggleGroupItem>)}</ToggleGroup> : <p className="rounded-xl border border-white/10 p-4 text-sm text-muted-foreground">{availabilityError ?? "Nenhum horário disponível neste dia."}</p>}</div><div className="rounded-xl border border-primary/20 bg-primary/6 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline size-4 text-primary" /> O horário será validado novamente no banco antes da confirmação.</div></div> : null}
          {step === 3 ? <FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="firstNameVisible">Nome</FieldLabel><Input id="firstNameVisible" value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></Field><Field><FieldLabel htmlFor="lastNameVisible">Sobrenome</FieldLabel><Input id="lastNameVisible" value={lastName} onChange={(event) => setLastName(event.target.value)} required /></Field></div><Field><FieldLabel htmlFor="bookingEmail">E-mail</FieldLabel><Input id="bookingEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field><Field><FieldLabel htmlFor="phoneVisible">Telefone</FieldLabel><Input id="phoneVisible" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field><Field orientation="horizontal"><Checkbox id="policyVisible" checked={policy} onCheckedChange={(value) => setPolicy(value === true)} /><FieldLabel htmlFor="policyVisible" className="font-normal">Aceito a política de cancelamento de {catalog.business.cancellationNoticeHours} horas.</FieldLabel></Field></FieldGroup> : null}
          {step === 4 ? <div className="flex flex-col gap-5"><div className="rounded-2xl border border-white/8 bg-black/15 p-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary"><CreditCard /></div><div><p className="font-medium">Sinal de reserva</p><p className="text-xs text-muted-foreground">Gateway simulado; nenhum dado de cartão é armazenado.</p></div></div><Separator className="my-5" /><div className="flex justify-between text-sm"><span>Valor do sinal</span><span className="font-heading text-xl font-semibold">{euro(depositCents)}</span></div><p className="mt-2 text-xs text-muted-foreground">Este valor será abatido do total. Cancelando no prazo, ele vira crédito.</p></div><FieldGroup><Field><FieldLabel htmlFor="card">Cartão de demonstração</FieldLabel><Input id="card" defaultValue="4242 4242 4242 4242" readOnly /></Field></FieldGroup>{state.message ? <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p> : null}</div> : null}
          <div className="mt-8 flex items-center justify-between"><Button type="button" variant="ghost" onClick={(event) => { event.preventDefault(); setStep((current) => Math.max(0, current - 1)); }} disabled={step === 0 || pending}><ArrowLeft data-icon="inline-start" /> Voltar</Button>{step < 4 ? <Button key={`continue-${step}`} type="button" onClick={(event) => { event.preventDefault(); next(); }} disabled={isLoadingSlots || (step === 2 && (!time || !selectedSlot)) || (step === 3 && (!firstName || !lastName || !email || !phone || !policy))}>Continuar <ArrowRight data-icon="inline-end" /></Button> : <Button key="submit-booking" type="submit" disabled={pending || !time}>{pending ? "Confirmando..." : `Pagar ${euro(depositCents)}`}<CreditCard data-icon="inline-start" /></Button>}</div>
        </CardContent>
      </Card>
      <Card className="h-fit border-white/8 lg:sticky lg:top-5"><CardHeader><CardTitle className="font-heading text-base">Resumo da reserva</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><div><p className="text-xs text-muted-foreground">Serviço</p><p className="mt-1 text-sm font-medium">{service.name}</p><p className="text-xs text-muted-foreground">{service.durationMinutes} min</p></div><Separator /><div><p className="text-xs text-muted-foreground">Profissional</p><p className="mt-1 text-sm font-medium">{selectedStaff?.displayName ?? "Qualquer disponível"}</p></div><div><p className="text-xs text-muted-foreground">Data e horário</p><p className="mt-1 text-sm font-medium">{catalog.dates.find((item) => item.value === date)?.label ?? date} · {time || "A escolher"}</p></div><Separator /><div className="flex justify-between text-sm"><span>Total</span><span>{euro(service.priceCents)}</span></div><div className="flex justify-between text-sm text-muted-foreground"><span>Sinal agora</span><span>{euro(depositCents)}</span></div><div className="flex justify-between font-medium"><span>No local</span><span>{euro(service.priceCents - depositCents)}</span></div><div className="rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs leading-5 text-white"><CalendarCheck className="mr-2 inline size-4" /> Confirmação imediata após o sinal simulado.</div></CardContent></Card>
    </form>
  );
}
