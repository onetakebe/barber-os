/* Formatação compartilhada pelo wizard, pelo resumo e pela confirmação da reserva pública. */

export const money = (cents: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);

/** "qui, 17 de set" a partir de YYYY-MM-DD, sem passar por fuso local. */
export const dayLabel = (date: string) => date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00.000Z`)).replaceAll(".", "") : "";

/** "qui, 17 de set, 09:00" de um instante ISO, no fuso da barbearia. */
export const dateTimeLabel = (iso: string, timezone: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replaceAll(".", "");
