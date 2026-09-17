"use client";

import { useEffect, useId, useMemo, useRef, type KeyboardEvent } from "react";

import { hourOptions, joinTime, minuteOptions, nearestAvailable, resolveTime, splitTime, stepAvailable, type TimeOption } from "@/domain/appointments/time-picker";
import { cn } from "@/lib/utils";

/* Rodas de hora e minuto da reserva pública, no estilo do seletor de alarme do celular. Só desenha
   o que `slots` permite — a regra está em `@/domain/appointments/time-picker`. Cada coluna é um
   contêiner rolável com `scroll-snap`: toque e roda do mouse rolam, o repouso escolhe a opção do
   centro (ou a disponível mais perto), clique escolhe direto e as setas do teclado pulam as
   bloqueadas. Nenhuma combinação bloqueada chega ao `onChange`. */

const ROW_PX = 40;
const VISIBLE_ROWS = 5;
const PAD_ROWS = (VISIBLE_ROWS - 1) / 2;
/** Repouso da rolagem: sem `scrollend` no Safari, a última posição vale depois desta pausa. */
const SETTLE_MS = 120;

type Props = {
  slots: { time: string }[];
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
};

export function TimeWheelPicker({ slots, value, onChange, disabled = false }: Props) {
  const times = useMemo(() => slots.map((slot) => slot.time), [slots]);
  const { hour, minute } = splitTime(value);
  const hours = useMemo(() => hourOptions(times), [times]);
  const minutes = useMemo(() => minuteOptions(times, hour), [times, hour]);

  // Trocar de hora mantém o minuto se a combinação existir; senão o válido mais perto dessa hora.
  function selectHour(next: string) {
    const resolved = resolveTime(times, next, minute);
    if (resolved && resolved !== value) onChange(resolved);
  }

  function selectMinute(next: string) {
    const resolved = joinTime(hour, next);
    if (times.includes(resolved) && resolved !== value) onChange(resolved);
  }

  return (
    <div role="group" aria-label="Horário" aria-busy={disabled} className={cn("rounded-2xl border border-white/8 bg-black/15 p-3 transition-opacity", disabled && "opacity-50")}>
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        <WheelColumn label="Hora" options={hours} value={hour} onChange={selectHour} disabled={disabled} />
        <span className="font-heading text-2xl text-muted-foreground" aria-hidden="true">:</span>
        <WheelColumn label="Minuto" options={minutes} value={minute} onChange={selectMinute} disabled={disabled} />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Role ou toque para escolher. Riscado: indisponível.</p>
    </div>
  );
}

function WheelColumn({ label, options, value, onChange, disabled }: { label: string; options: TimeOption[]; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number>(undefined);
  const lastListKey = useRef<string>(undefined);
  const selectedIndex = options.findIndex((item) => item.value === value);
  // Primeira montagem e lista com outras opções (os minutos de outra jornada) saltam direto; a
  // mesma lista — as horas são sempre 00–23 — desliza até o valor.
  const listKey = options.map((item) => item.value).join(",");

  // Alinha a roda ao valor escolhido: a linha `i` fica no centro quando `scrollTop = i × ROW_PX`.
  useEffect(() => {
    const list = listRef.current;
    if (!list || selectedIndex < 0) return;
    const top = selectedIndex * ROW_PX;
    if (Math.abs(list.scrollTop - top) < 1) return;
    const instant = lastListKey.current !== listKey || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastListKey.current = listKey;
    list.scrollTo({ top, behavior: instant ? "instant" : "smooth" });
  }, [selectedIndex, listKey]);

  // Um repouso pendente pertence à lista/estado em que a rolagem aconteceu: não pode escolher
  // depois que a roda foi desabilitada ou trocou de opções.
  useEffect(() => () => window.clearTimeout(settleTimer.current), [disabled, listKey]);

  // Repouso da rolagem (toque, roda do mouse, trackpad): a linha do centro vira seleção; se ela
  // estiver bloqueada, a roda volta para a disponível mais perto.
  function handleScroll() {
    if (disabled) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const list = listRef.current;
      if (!list) return;
      const centered = Math.round(list.scrollTop / ROW_PX);
      const target = nearestAvailable(options, centered);
      if (target < 0) return;
      if (target !== centered) list.scrollTo({ top: target * ROW_PX, behavior: "smooth" });
      if (options[target]!.value !== value) onChange(options[target]!.value);
    }, SETTLE_MS);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const moves: Record<string, () => number> = {
      ArrowUp: () => stepAvailable(options, selectedIndex, -1),
      ArrowDown: () => stepAvailable(options, selectedIndex, 1),
      Home: () => stepAvailable(options, -1, 1),
      End: () => stepAvailable(options, options.length, -1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = move();
    if (next >= 0 && next !== selectedIndex) onChange(options[next].value);
  }

  return (
    <div className="relative" style={{ height: ROW_PX * VISIBLE_ROWS }}>
      {/* Faixa do centro: a linha que está "encaixada". */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 rounded-xl border-y border-brand/40 bg-white/[.05]" style={{ top: ROW_PX * PAD_ROWS, height: ROW_PX }} />
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-disabled={disabled || undefined}
        aria-activedescendant={selectedIndex >= 0 ? `${id}-${options[selectedIndex]!.value}` : undefined}
        tabIndex={disabled ? -1 : 0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-full w-20 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_bottom,transparent,black_35%,black_65%,transparent)] focus-visible:ring-3 focus-visible:ring-ring/50",
          disabled && "pointer-events-none",
        )}
      >
        {/* Espaçadores em vez de padding: o padding final de um contêiner rolável nem sempre entra na rolagem. */}
        <div aria-hidden="true" style={{ height: ROW_PX * PAD_ROWS }} />
        {options.map((item) => {
          const isSelected = item.value === value;
          return (
            <div
              key={item.value}
              id={`${id}-${item.value}`}
              role="option"
              aria-selected={isSelected}
              aria-disabled={!item.available || undefined}
              onClick={() => item.available && !disabled && onChange(item.value)}
              className={cn(
                "flex snap-center items-center justify-center font-mono text-lg transition-colors select-none",
                isSelected ? "font-semibold text-brand" : item.available ? "cursor-pointer text-white/70 hover:text-white" : "cursor-not-allowed text-white/25 line-through decoration-white/20",
              )}
              style={{ height: ROW_PX }}
            >
              {item.value}
            </div>
          );
        })}
        <div aria-hidden="true" style={{ height: ROW_PX * PAD_ROWS }} />
      </div>
    </div>
  );
}
