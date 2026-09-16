import Link from "next/link";
import { Check } from "lucide-react";

import type { BookingActionState } from "@/app/(public)/barbearia/[slug]/agendar/actions";
import { dateTimeLabel, money } from "@/components/booking/booking-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  booking: NonNullable<BookingActionState["booking"]>;
  business: { slug: string; timezone: string };
};

/** Confirmação da reserva: todos os itens, duração total e total, e o lembrete de que nada foi cobrado. */
export function BookingSuccess({ booking, business }: Props) {
  return (
    <Card className="panel-glow mx-auto max-w-xl border-white/20 bg-white/[.04]">
      <CardContent className="flex flex-col items-center p-8 text-center sm:p-12">
        <div className="grid size-16 place-items-center rounded-full bg-brand text-brand-ink"><Check className="size-7" /></div>
        <Badge className="mt-6">Reserva confirmada</Badge>
        <h1 className="font-heading mt-4 text-3xl font-semibold">Sua cadeira está reservada.</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{dateTimeLabel(booking.startsAt, business.timezone)} com {booking.staffName}. Código {booking.appointmentId.slice(0, 8)}.</p>
        <div className="mt-7 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
          <ul className="flex flex-col gap-2 text-sm">{booking.services.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.name}</span><span className="text-muted-foreground">{item.durationMinutes} min · {money(item.priceCents, booking.currency)}</span></li>)}</ul>
          <Separator className="my-3" />
          <div className="flex justify-between text-xs text-muted-foreground"><span>Duração total</span><span>{booking.durationMinutes} min</span></div>
          <div className="mt-2 flex justify-between font-medium"><span>Total a pagar na barbearia</span><span>{money(booking.totalCents, booking.currency)}</span></div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Nada foi cobrado agora. Para cancelar, avise com {booking.cancellationNoticeHours}h de antecedência.</p>
        <Button asChild className="mt-7 w-full"><Link href={`/barbearia/${business.slug}`}>Voltar à barbearia</Link></Button>
      </CardContent>
    </Card>
  );
}
