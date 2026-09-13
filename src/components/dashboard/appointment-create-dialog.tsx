"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";

import { createAppointmentAction, type AgendaActionState } from "@/app/(dashboard)/agenda/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Service = { id: string; name: string; durationMinutes: number; priceCents: number };
type Staff = { id: string; name: string; initials: string; color: string };
type Day = { value: string; label: string };
type Slot = { time: string; staffIds: string[] };

const initialState: AgendaActionState = { status: "idle" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function AppointmentCreateDialog({
  services, staff, days, tenantSlug, defaultDate, prefill, onOpenChange,
}: {
  services: Service[];
  staff: Staff[];
  days: Day[];
  tenantSlug: string;
  defaultDate: string;
  prefill?: { staffId: string; date: string; time: string } | null;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotError, setSlotError] = useState<string>();
  const [loadingSlots, startLoadingSlots] = useTransition();
  const [state, action, pending] = useActionState(createAppointmentAction, initialState);

  // Clique numa faixa vazia da grade abre o diálogo já com profissional, dia e hora.
  useEffect(() => {
    if (!prefill) return;
    setStaffId(prefill.staffId);
    setDate(prefill.date);
    setTime(prefill.time);
    setOpen(true);
  }, [prefill]);

  useEffect(() => {
    if (!open || !serviceId || !date) return;
    let cancelled = false;
    startLoadingSlots(async () => {
      setSlotError(undefined);
      try {
        const query = new URLSearchParams({ date, serviceId, staffId });
        const response = await fetch(`/api/public/${tenantSlug}/availability?${query}`);
        if (!response.ok) throw new Error("AVAILABILITY_FAILED");
        const payload = (await response.json()) as { slots: Slot[] };
        if (cancelled) return;
        setSlots(payload.slots);
        setTime((current) => (payload.slots.some((slot) => slot.time === current) ? current : payload.slots[0]?.time ?? ""));
      } catch {
        if (cancelled) return;
        setSlots([]);
        setTime("");
        setSlotError("Não foi possível carregar os horários livres.");
      }
    });
    return () => { cancelled = true; };
  }, [open, serviceId, staffId, date, tenantSlug]);

  useEffect(() => {
    if (state.status === "success") { setOpen(false); setTime(""); }
  }, [state.status]);

  const service = services.find((item) => item.id === serviceId);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => { setOpen(next); onOpenChange?.(next); }}
      >
        <DialogTrigger asChild>
          <Button type="button"><CalendarPlus data-icon="inline-start" />Novo agendamento</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Novo agendamento</DialogTitle>
            <DialogDescription>
              O horário é validado no banco antes de gravar — se alguém ocupar antes, você é avisado.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="flex flex-col gap-5">
            <input type="hidden" name="serviceId" value={serviceId} />
            <input type="hidden" name="staffId" value={staffId} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="novo-servico">Serviço</FieldLabel>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger id="novo-servico"><SelectValue placeholder="Escolha o serviço" /></SelectTrigger>
                  <SelectContent>
                    {services.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name} · {item.durationMinutes} min · {money(item.priceCents)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="novo-profissional">Profissional</FieldLabel>
                <Select value={staffId} onValueChange={setStaffId}>
                  <SelectTrigger id="novo-profissional"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Primeiro disponível</SelectItem>
                    {staff.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="novo-dia">Dia</FieldLabel>
                <Select value={date} onValueChange={setDate}>
                  <SelectTrigger id="novo-dia"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map((day) => <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">Horários livres</legend>
              {loadingSlots ? (
                <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Calculando disponibilidade...</p>
              ) : slots.length ? (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot.time}
                      type="button"
                      size="sm"
                      variant={time === slot.time ? "default" : "outline"}
                      aria-pressed={time === slot.time}
                      className={cn("font-mono", time === slot.time && "ring-1 ring-primary")}
                      onClick={() => setTime(slot.time)}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="border border-white/10 p-3 text-sm text-muted-foreground">
                  {slotError ?? "Nenhum horário livre neste dia para esta combinação."}
                </p>
              )}
            </fieldset>

            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="novo-nome">Nome</FieldLabel>
                  <Input id="novo-nome" name="firstName" required autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="novo-sobrenome">Sobrenome</FieldLabel>
                  <Input id="novo-sobrenome" name="lastName" required autoComplete="off" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="novo-telefone">Telefone</FieldLabel>
                <Input id="novo-telefone" name="phone" type="tel" required autoComplete="off" />
                <p className="mt-1 text-xs text-muted-foreground">Cliente já cadastrado com este telefone é reaproveitado.</p>
              </Field>
              <Field>
                <FieldLabel htmlFor="novo-obs">Observação</FieldLabel>
                <Input id="novo-obs" name="notes" maxLength={300} autoComplete="off" />
              </Field>
            </FieldGroup>

            {state.status === "error" && state.message ? (
              <p role="alert" className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={pending || !time || !serviceId}>
                {pending ? <><Loader2 className="animate-spin" data-icon="inline-start" />Marcando...</> : `Marcar ${service ? `· ${service.durationMinutes} min` : ""}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {state.status === "success" && state.message ? (
        <p role="status" className="text-xs text-primary">{state.message}</p>
      ) : null}
    </>
  );
}
