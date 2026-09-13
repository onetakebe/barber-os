type AvailabilityRecord = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
};

type DateRange = { startsAt: Date; endsAt: Date };

type StaffAvailabilityRecord = {
  id: string;
  availability: AvailabilityRecord[];
  timeOff: DateRange[];
  appointments: DateRange[];
};

type SlotInput = {
  date: string;
  timezone: string;
  durationMinutes: number;
  intervalMinutes: number;
  staff: StaffAvailabilityRecord[];
  /** Horários que já começaram antes deste instante saem (só afeta o dia de hoje). */
  now?: Date;
};

export type BookableDay = { date: string; available: boolean };

export type AvailableSlot = {
  time: string;
  startsAt: string;
  endsAt: string;
  staffIds: string[];
};

function datePartsInZone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function localDateTimeToUtc(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = desiredWallClock;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = datePartsInZone(new Date(candidate), timezone);
    const renderedWallClock = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    candidate -= renderedWallClock - desiredWallClock;
  }
  return new Date(candidate);
}

function minuteToTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function overlaps(start: Date, end: Date, range: DateRange) {
  return start < range.endsAt && end > range.startsAt;
}

export function getAvailableSlotsFromRecords(input: SlotInput): AvailableSlot[] {
  const dayOfWeek = new Date(`${input.date}T12:00:00.000Z`).getUTCDay();
  const slots = new Map<number, AvailableSlot>();

  for (const member of input.staff) {
    for (const schedule of member.availability.filter((item) => item.dayOfWeek === dayOfWeek)) {
      for (let minute = schedule.startMinute; minute + input.durationMinutes <= schedule.endMinute; minute += input.intervalMinutes) {
        const endMinute = minute + input.durationMinutes;
        const time = minuteToTime(minute);
        const endTime = minuteToTime(endMinute);
        const startsAt = localDateTimeToUtc(input.date, time, input.timezone);
        if (input.now !== undefined && startsAt <= input.now) continue;
        const endsAt = localDateTimeToUtc(input.date, endTime, input.timezone);
        const hitsBreak = schedule.breakStartMinute !== null && schedule.breakEndMinute !== null && minute < schedule.breakEndMinute && endMinute > schedule.breakStartMinute;
        const occupied = [...member.timeOff, ...member.appointments].some((range) => overlaps(startsAt, endsAt, range));
        const slot = slots.get(minute) ?? { time, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), staffIds: [] };
        if (!hitsBreak && !occupied) slot.staffIds.push(member.id);
        slots.set(minute, slot);
      }
    }
  }

  return [...slots.entries()].sort(([a], [b]) => a - b).map(([, slot]) => slot);
}

/** Data local (YYYY-MM-DD) de um instante no fuso do tenant. */
export function localDateInZone(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

/** Soma dias a uma data YYYY-MM-DD sem passar por fuso local. */
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysOfMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

/** Quais dias de um mês ainda têm horário: fora da janela [hoje, hoje + horizonte], sem
 *  jornada ou tomado por bloqueio/agendamentos = indisponível. Mesma regra dos horários, dia a dia. */
export function getBookableDaysFromRecords(input: Omit<SlotInput, "date" | "now"> & { month: string; now: Date; horizonDays: number }): BookableDay[] {
  const today = localDateInZone(input.now, input.timezone);
  const last = addDays(today, input.horizonDays);
  return daysOfMonth(input.month).map((date) => {
    if (date < today || date > last) return { date, available: false };
    const slots = getAvailableSlotsFromRecords({ ...input, date, now: input.now });
    return { date, available: slots.some((slot) => slot.staffIds.length > 0) };
  });
}
