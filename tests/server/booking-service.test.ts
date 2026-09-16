import { describe, expect, it } from "vitest";

import { BookingError, selectBookingSlot } from "@/server/services/booking";
import { normalizeServiceIds, readServiceIds } from "@/server/services/booking-services";

const slots = [
  { time: "10:00", startsAt: "2026-07-21T08:00:00.000Z", endsAt: "2026-07-21T08:45:00.000Z", staffIds: ["staff-a", "staff-b"] },
];

describe("booking slot selection", () => {
  it("respects the requested eligible professional", () => {
    expect(selectBookingSlot(slots, "10:00", "staff-b").staffId).toBe("staff-b");
  });

  it("uses the first available professional for an any-professional booking", () => {
    expect(selectBookingSlot(slots, "10:00", "any").staffId).toBe("staff-a");
  });

  it("returns a stable conflict when the slot is no longer available", () => {
    expect(() => selectBookingSlot(slots, "11:00", "any")).toThrowError(new BookingError("SLOT_CONFLICT"));
  });
});

describe("service selection input", () => {
  it("reads every repeated serviceIds value from a query string", () => {
    expect(readServiceIds(new URLSearchParams("serviceIds=a&serviceIds=b&date=2026-07-21"))).toEqual(["a", "b"]);
  });

  it("reads every repeated serviceIds value from a form", () => {
    const form = new FormData();
    form.append("serviceIds", "a");
    form.append("serviceIds", "");
    form.append("serviceIds", "b");
    expect(readServiceIds(form)).toEqual(["a", "b"]);
  });

  it("falls back to the single serviceId of the internal consumers", () => {
    expect(readServiceIds(new URLSearchParams("serviceId=a"))).toEqual(["a"]);
    expect(readServiceIds(new URLSearchParams("date=2026-07-21"))).toEqual([]);
  });

  it("normalizes a single serviceId into a one-item list", () => {
    expect(normalizeServiceIds({ serviceId: "a" })).toEqual(["a"]);
    expect(normalizeServiceIds({ serviceIds: ["a", "b"] })).toEqual(["a", "b"]);
    expect(normalizeServiceIds({})).toEqual([]);
  });
});
