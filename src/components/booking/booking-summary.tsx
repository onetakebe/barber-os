import { CalendarCheck } from "lucide-react";

import { dayLabel, money } from "@/components/booking/booking-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  services: { id: string; name: string; durationMinutes: number; priceCents: number }[];
  totalMinutes: number;
  totalCents: number;
  currency: string;
  /** Nome do profissional escolhido; sem ele, "Qualquer disponível". */
  staffName?: string;
  date: string;
  time: string;
};

/** Painel lateral do wizard: itens escolhidos, duração total, profissional, dia/hora e total. */
export function BookingSummary({ services, totalMinutes, totalCents, currency, staffName, date, time }: Props) {
  return (
    <Card className="light-panel h-fit border-0 lg:sticky lg:top-5">
      <CardHeader><CardTitle className="font-heading text-base">Resumo da reserva</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Serviços</p>
          {services.length ? <ul className="mt-1 flex flex-col gap-1">{services.map((item) => <li key={item.id} className="flex justify-between gap-3 text-sm"><span className="font-medium">{item.name}</span><span className="text-muted-foreground">{item.durationMinutes} min · {money(item.priceCents, currency)}</span></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Escolha pelo menos um serviço.</p>}
          <p className="mt-1 text-xs text-muted-foreground">{totalMinutes} min no total</p>
        </div>
        <Separator />
        <div><p className="text-xs text-muted-foreground">Profissional</p><p className="mt-1 text-sm font-medium">{staffName ?? "Qualquer disponível"}</p></div>
        <div><p className="text-xs text-muted-foreground">Data e horário</p><p className="mt-1 text-sm font-medium">{date ? `${dayLabel(date)} · ${time || "A escolher"}` : "A escolher"}</p></div>
        <Separator />
        <div className="flex justify-between font-medium"><span>Total, pago na barbearia</span><span>{money(totalCents, currency)}</span></div>
        <div className="rounded-xl border border-black/10 bg-black/5 p-3 text-xs leading-5 text-foreground"><CalendarCheck className="mr-2 inline size-4" /> Confirmação imediata, sem cobrança online.</div>
      </CardContent>
    </Card>
  );
}
