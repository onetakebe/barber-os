/* Lógica pura das rodas de hora e minuto da reserva pública — sem React, para testar com listas.
   A roda só oferece o que o servidor devolveu em `slots[].time` ("HH:mm"): nada aqui presume o
   intervalo de 15 minutos nem os minutos 00/15/30/45 — uma jornada às 09:10 dá 10/25/40/55. */

export type TimeOption = { value: string; available: boolean };

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));

export function splitTime(time: string) {
  const [hour = "", minute = ""] = time.split(":");
  return { hour, minute };
}

export function joinTime(hour: string, minute: string) {
  return `${hour}:${minute}`;
}

/** Horas 00–23, todas visíveis; disponível quando algum horário do dia começa nela. */
export function hourOptions(times: readonly string[]): TimeOption[] {
  const withSlot = new Set(times.map((time) => splitTime(time).hour));
  return HOURS.map((value) => ({ value, available: withSlot.has(value) }));
}

/** Só os minutos que existem em algum horário do dia entram na roda, em ordem; disponível quando
 *  `hora:minuto` está na lista. Sem hora ativa (ou hora sem horário) tudo fica bloqueado. */
export function minuteOptions(times: readonly string[], hour: string): TimeOption[] {
  const valid = new Set(times);
  const minutes = [...new Set(times.map((time) => splitTime(time).minute))].sort();
  return minutes.map((value) => ({ value, available: valid.has(joinTime(hour, value)) }));
}

/** Ao trocar de hora: mantém o minuto se a combinação existir; senão o minuto válido mais próximo
 *  dessa hora (empate: o mais cedo). `null` quando a hora não tem minuto nenhum — a seleção não muda. */
export function resolveTime(times: readonly string[], hour: string, minute: string): string | null {
  const candidates = minuteOptions(times, hour).filter((item) => item.available).map((item) => item.value);
  if (candidates.length === 0) return null;
  if (candidates.includes(minute)) return joinTime(hour, minute);
  const wanted = Number(minute);
  const closest = candidates.reduce((best, value) => (Math.abs(Number(value) - wanted) < Math.abs(Number(best) - wanted) ? value : best));
  return joinTime(hour, closest);
}

/** Índice da opção disponível mais próxima de `index` (empate: a de cima); -1 sem opção disponível. */
export function nearestAvailable(options: readonly TimeOption[], index: number): number {
  const target = Math.min(Math.max(index, 0), options.length - 1);
  for (let distance = 0; distance < options.length; distance += 1) {
    if (options[target - distance]?.available) return target - distance;
    if (options[target + distance]?.available) return target + distance;
  }
  return -1;
}

/** Próxima opção disponível a partir de `index` na direção `delta` (-1 sobe, +1 desce). Sem mais
 *  nenhuma, fica onde está; -1 quando o ponto de partida já está fora da lista (Home/End numa
 *  lista toda bloqueada). */
export function stepAvailable(options: readonly TimeOption[], index: number, delta: number): number {
  for (let cursor = index + delta; cursor >= 0 && cursor < options.length; cursor += delta) {
    if (options[cursor]?.available) return cursor;
  }
  return index >= 0 && index < options.length ? index : -1;
}
