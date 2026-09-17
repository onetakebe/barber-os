"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* Calendário de mês da reserva pública. Recebe os dias já calculados pelo servidor
   (`/api/public/[slug]/availability/month`); só desenha e navega. Sem dependência nova. */

export type CalendarDay = { date: string; available: boolean };

const weekdays = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function monthLabel(month: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00.000Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthCalendar({ month, days, selected, minMonth, maxMonth, loading = false, onSelect, onMonthChange }: {
  month: string;
  days: CalendarDay[];
  selected: string;
  minMonth: string;
  maxMonth: string;
  loading?: boolean;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
}) {
  // Coluna do dia 1: getUTCDay() dá 0 = domingo; a grade começa na segunda.
  const firstWeekday = (new Date(`${month}-01T12:00:00.000Z`).getUTCDay() + 6) % 7;

  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-4" aria-busy={loading}>
      <div className="mb-3 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" onClick={() => onMonthChange(shiftMonth(month, -1))} disabled={loading || month <= minMonth} aria-label="Mês anterior"><ChevronLeft /></Button>
        <p className="font-heading text-base font-semibold" aria-live="polite">{monthLabel(month)}</p>
        <Button type="button" variant="ghost" size="icon" onClick={() => onMonthChange(shiftMonth(month, 1))} disabled={loading || month >= maxMonth} aria-label="Próximo mês"><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[.12em] text-muted-foreground" aria-hidden="true">
        {weekdays.map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div className={cn("mt-1 grid grid-cols-7 gap-1", loading && "opacity-50")}>
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`pad-${index}`} />)}
        {days.map((day) => {
          const isSelected = day.date === selected;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day.date)}
              disabled={!day.available || loading}
              aria-pressed={isSelected}
              aria-label={new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day.date}T12:00:00.000Z`))}
              className={cn(
                "h-10 rounded-xl font-mono text-sm transition-colors",
                isSelected ? "bg-brand text-brand-ink" : day.available ? "bg-white/[.04] text-white hover:bg-white/10" : "text-white/25 line-through decoration-white/20",
                "disabled:cursor-not-allowed",
              )}
            >
              {Number(day.date.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
