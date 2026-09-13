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
