import { describe, expect, it } from "vitest";

import {
  getAvailableSlotsFromRecords,
  getBookableDaysFromRecords,
  localDateTimeToUtc,
} from "@/server/services/availability";

describe("tenant availability service", () => {
  it("converts a Brussels summer wall-clock time to UTC", () => {
    expect(localDateTimeToUtc("2026-07-21", "10:15", "Europe/Brussels").toISOString()).toBe("2026-07-21T08:15:00.000Z");
  });

  it("combines professionals while removing breaks, blocks and appointments", () => {
    const slots = getAvailableSlotsFromRecords({
      date: "2026-07-21",
      timezone: "Europe/Brussels",
      durationMinutes: 45,
      intervalMinutes: 15,
      staff: [
        {
          id: "staff-1",
          availability: [{ dayOfWeek: 2, startMinute: 540, endMinute: 720, breakStartMinute: 630, breakEndMinute: 660 }],
          timeOff: [],
          appointments: [{ startsAt: new Date("2026-07-21T07:30:00.000Z"), endsAt: new Date("2026-07-21T08:15:00.000Z") }],
        },
        {
          id: "staff-2",
          availability: [{ dayOfWeek: 2, startMinute: 540, endMinute: 720, breakStartMinute: null, breakEndMinute: null }],
          timeOff: [{ startsAt: new Date("2026-07-21T07:00:00.000Z"), endsAt: new Date("2026-07-21T08:00:00.000Z") }],
          appointments: [],
        },
      ],
    });

    expect(slots.find((slot) => slot.time === "09:00")?.staffIds).toEqual([]);
    expect(slots.find((slot) => slot.time === "10:30")?.staffIds).toEqual(["staff-2"]);
    expect(slots.find((slot) => slot.time === "11:15")?.staffIds).toEqual(["staff-1", "staff-2"]);
  });
});

describe("slot boundaries for a summed duration", () => {
  // Terça 2026-07-21, jornada 10:00–18:00 sem pausa; um atendimento 10:30–11:00 (08:30–09:00Z no verão).
  const workday = { dayOfWeek: 2, startMinute: 600, endMinute: 1080, breakStartMinute: null, breakEndMinute: null };
  const occupied = { startsAt: new Date("2026-07-21T08:30:00.000Z"), endsAt: new Date("2026-07-21T09:00:00.000Z") };
  const times = (durationMinutes: number, appointments = [occupied]) =>
    getAvailableSlotsFromRecords({ date: "2026-07-21", timezone: "Europe/Brussels", durationMinutes, intervalMinutes: 15, staff: [{ id: "staff-1", availability: [workday], timeOff: [], appointments }] })
      .filter((slot) => slot.staffIds.length > 0)
      .map((slot) => slot.time);

  it("does not let a 60-minute booking start at 17:30 when the day ends at 18:00", () => {
    const sixty = times(60);
    expect(sixty.at(-1)).toBe("17:00");
    expect(sixty).not.toContain("17:15");
    expect(sixty).not.toContain("17:30");
    expect(times(30).at(-1)).toBe("17:30");
  });

  it("blocks a 60-minute start at 10:00 when 10:30–11:00 is taken, but not a 30-minute one", () => {
    expect(times(60)).not.toContain("10:00");
    expect(times(60)).not.toContain("10:15");
    expect(times(30)).toContain("10:00");
  });

  it("allows ending exactly when another appointment starts and starting exactly when it ends", () => {
    // Jornada 09:00–18:00 para haver espaço antes das 10:30; intervalos são [início, fim).
    const sixty = getAvailableSlotsFromRecords({ date: "2026-07-21", timezone: "Europe/Brussels", durationMinutes: 60, intervalMinutes: 15, staff: [{ id: "staff-1", availability: [{ ...workday, startMinute: 540 }], timeOff: [], appointments: [occupied] }] })
      .filter((slot) => slot.staffIds.length > 0)
      .map((slot) => slot.time);
    expect(sixty).toContain("09:30"); // termina 10:30, exatamente no início do outro
    expect(sixty).not.toContain("09:45"); // terminaria 10:45, dentro do outro
    expect(sixty).toContain("11:00"); // começa exatamente no fim do outro
  });
});

describe("Brussels wall clock across seasons", () => {
  it("converts a winter wall-clock time to UTC (+1)", () => {
    expect(localDateTimeToUtc("2026-01-20", "10:15", "Europe/Brussels").toISOString()).toBe("2026-01-20T09:15:00.000Z");
  });

  it("uses the offset in force on the day the clocks change", () => {
    // 29/03/2026 muda para o verão às 02:00; 25/10/2026 volta ao inverno às 03:00.
    expect(localDateTimeToUtc("2026-03-29", "09:00", "Europe/Brussels").toISOString()).toBe("2026-03-29T07:00:00.000Z");
    expect(localDateTimeToUtc("2026-10-25", "09:00", "Europe/Brussels").toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("persists instants whose gap is exactly the summed duration, in summer and in winter", () => {
    const staff = [{ id: "staff-1", availability: [{ dayOfWeek: 2, startMinute: 540, endMinute: 720, breakStartMinute: null, breakEndMinute: null }], timeOff: [], appointments: [] }];
    for (const [date, expectedStart] of [["2026-07-21", "2026-07-21T07:00:00.000Z"], ["2026-01-20", "2026-01-20T08:00:00.000Z"]] as const) {
      const slot = getAvailableSlotsFromRecords({ date, timezone: "Europe/Brussels", durationMinutes: 75, intervalMinutes: 15, staff }).find((item) => item.time === "09:00");
      expect(slot?.startsAt).toBe(expectedStart);
      expect(new Date(slot!.endsAt).getTime() - new Date(slot!.startsAt).getTime()).toBe(75 * 60_000);
    }
  });
});

describe("slot cutoff by now", () => {
  const staff = [{ id: "staff-1", availability: [{ dayOfWeek: 2, startMinute: 540, endMinute: 720, breakStartMinute: null, breakEndMinute: null }], timeOff: [], appointments: [] }];

  it("drops today's slots that already started, in the tenant timezone", () => {
    // 2026-07-21 is a Tuesday; 10:00 in Brussels (summer) = 08:00Z.
    const slots = getAvailableSlotsFromRecords({ date: "2026-07-21", timezone: "Europe/Brussels", durationMinutes: 30, intervalMinutes: 15, staff, now: new Date("2026-07-21T08:00:00.000Z") });
    expect(slots[0]?.time).toBe("10:15");
  });

  it("keeps every slot on a future day", () => {
    const slots = getAvailableSlotsFromRecords({ date: "2026-07-28", timezone: "Europe/Brussels", durationMinutes: 30, intervalMinutes: 15, staff, now: new Date("2026-07-21T08:00:00.000Z") });
    expect(slots[0]?.time).toBe("09:00");
  });
});

describe("bookable days of a month", () => {
  // Works Tuesdays and Thursdays only, 09:00–12:00.
  const staff = [{
    id: "staff-1",
    availability: [
      { dayOfWeek: 2, startMinute: 540, endMinute: 720, breakStartMinute: null, breakEndMinute: null },
      { dayOfWeek: 4, startMinute: 540, endMinute: 720, breakStartMinute: null, breakEndMinute: null },
    ],
    timeOff: [{ startsAt: new Date("2026-07-23T00:00:00.000Z"), endsAt: new Date("2026-07-24T00:00:00.000Z") }],
    appointments: [],
  }];
  const now = new Date("2026-07-21T08:00:00.000Z"); // Tuesday 10:00 in Brussels
  const days = getBookableDaysFromRecords({ month: "2026-07", timezone: "Europe/Brussels", now, horizonDays: 60, durationMinutes: 30, intervalMinutes: 15, staff });
  const byDate = Object.fromEntries(days.map((day) => [day.date, day.available]));

  it("returns one entry per day of the month", () => {
    expect(days).toHaveLength(31);
    expect(days[0]?.date).toBe("2026-07-01");
    expect(days[30]?.date).toBe("2026-07-31");
  });

  it("marks the past as unavailable and today as available while slots remain", () => {
    expect(byDate["2026-07-14"]).toBe(false); // a past Tuesday
    expect(byDate["2026-07-21"]).toBe(true); // today, 10:15 onwards still free
  });

  it("marks days without a schedule and days taken by time off as unavailable", () => {
    expect(byDate["2026-07-22"]).toBe(false); // Wednesday, no schedule
    expect(byDate["2026-07-23"]).toBe(false); // Thursday, fully blocked
    expect(byDate["2026-07-28"]).toBe(true); // next Tuesday
  });

  it("marks days beyond the horizon as unavailable", () => {
    const later = getBookableDaysFromRecords({ month: "2026-09", timezone: "Europe/Brussels", now, horizonDays: 60, durationMinutes: 30, intervalMinutes: 15, staff });
    const laterByDate = Object.fromEntries(later.map((day) => [day.date, day.available]));
    expect(laterByDate["2026-09-17"]).toBe(true); // Thursday, day 58
    expect(laterByDate["2026-09-22"]).toBe(false); // Tuesday, day 63
  });
});
