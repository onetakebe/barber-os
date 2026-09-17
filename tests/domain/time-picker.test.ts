import { describe, expect, it } from "vitest";

import { hourOptions, joinTime, minuteOptions, nearestAvailable, resolveTime, splitTime, stepAvailable } from "@/domain/appointments/time-picker";

/* Regras puras das rodas de hora e minuto: só o que o servidor devolveu em `slots[].time` pode
   virar seleção. Um dia da barbearia demo: 09:00–12:15 e 14:00–18:15 de 15 em 15 (pausa às 13h,
   reserva de 45 min), e uma jornada que começa às 09:10 para provar que nada presume 00/15/30/45. */
const demoDay = ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45", "12:00", "12:15", "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45", "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30", "17:45", "18:00", "18:15"];
const offsetDay = ["09:10", "09:25", "09:40", "09:55", "10:10", "10:25"];

describe("splitTime / joinTime", () => {
  it("splits and joins HH:mm without touching the padding", () => {
    expect(splitTime("09:05")).toEqual({ hour: "09", minute: "05" });
    expect(joinTime("18", "15")).toBe("18:15");
    expect(splitTime("")).toEqual({ hour: "", minute: "" });
  });
});

describe("hourOptions", () => {
  it("lists every hour 00–23 and only enables the ones with a slot", () => {
    const hours = hourOptions(demoDay);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toEqual({ value: "00", available: false });
    expect(hours[9]).toEqual({ value: "09", available: true });
    expect(hours[13]).toEqual({ value: "13", available: false }); // pausa do almoço
    expect(hours[18]).toEqual({ value: "18", available: true });
    expect(hours[19]).toEqual({ value: "19", available: false });
  });

  it("blocks every hour when there are no slots", () => {
    expect(hourOptions([]).every((hour) => !hour.available)).toBe(true);
  });
});

describe("minuteOptions", () => {
  it("offers only the minutes that exist in some slot of the day, in order", () => {
    expect(minuteOptions(demoDay, "10").map((item) => item.value)).toEqual(["00", "15", "30", "45"]);
    expect(minuteOptions(offsetDay, "09").map((item) => item.value)).toEqual(["10", "25", "40", "55"]);
  });

  it("blocks a minute whose combination with the active hour is not a slot", () => {
    const noon = Object.fromEntries(minuteOptions(demoDay, "12").map((item) => [item.value, item.available]));
    expect(noon).toEqual({ "00": true, "15": true, "30": false, "45": false });
    const late = Object.fromEntries(minuteOptions(offsetDay, "10").map((item) => [item.value, item.available]));
    expect(late).toEqual({ "10": true, "25": true, "40": false, "55": false });
  });

  it("keeps the minutes visible but all blocked for an hour without slots", () => {
    const lunch = minuteOptions(demoDay, "13");
    expect(lunch.map((item) => item.value)).toEqual(["00", "15", "30", "45"]);
    expect(lunch.every((item) => !item.available)).toBe(true);
    expect(minuteOptions(demoDay, "").every((item) => !item.available)).toBe(true);
  });
});

describe("resolveTime", () => {
  it("keeps the minute when the new hour has it", () => {
    expect(resolveTime(demoDay, "14", "45")).toBe("14:45");
  });

  it("falls back to the closest valid minute of the new hour", () => {
    expect(resolveTime(demoDay, "12", "45")).toBe("12:15");
    expect(resolveTime(demoDay, "18", "30")).toBe("18:15");
    expect(resolveTime(offsetDay, "10", "40")).toBe("10:25");
  });

  it("prefers the earlier minute on a tie", () => {
    // "15" fica a 5 minutos de 10 e de 20: vence o mais cedo.
    expect(resolveTime(["10:10", "10:20"], "10", "15")).toBe("10:10");
  });

  it("returns null when the hour has no valid minute, so the selection stays put", () => {
    expect(resolveTime(demoDay, "13", "00")).toBeNull();
    expect(resolveTime([], "09", "00")).toBeNull();
  });

  it("never produces a combination that is not in the slots", () => {
    for (const hour of hourOptions(demoDay).map((item) => item.value)) {
      for (const minute of ["00", "15", "30", "45", "05"]) {
        const resolved = resolveTime(demoDay, hour, minute);
        if (resolved !== null) expect(demoDay).toContain(resolved);
      }
    }
  });
});

describe("nearestAvailable / stepAvailable", () => {
  const options = [
    { value: "a", available: false },
    { value: "b", available: true },
    { value: "c", available: false },
    { value: "d", available: false },
    { value: "e", available: true },
    { value: "f", available: false },
  ];

  it("snaps to the closest available option, preferring the one above on a tie", () => {
    expect(nearestAvailable(options, 1)).toBe(1);
    expect(nearestAvailable(options, 0)).toBe(1);
    expect(nearestAvailable(options, 2)).toBe(1);
    expect(nearestAvailable(options, 3)).toBe(4);
    expect(nearestAvailable(options, 5)).toBe(4);
    expect(nearestAvailable(options, 99)).toBe(4);
    expect(nearestAvailable(options.map((item) => ({ ...item, available: false })), 2)).toBe(-1);
  });

  it("steps over blocked options and stays put at the ends", () => {
    expect(stepAvailable(options, 1, 1)).toBe(4);
    expect(stepAvailable(options, 4, -1)).toBe(1);
    expect(stepAvailable(options, 4, 1)).toBe(4);
    expect(stepAvailable(options, 1, -1)).toBe(1);
    expect(stepAvailable(options, 2, 1)).toBe(4);
  });
});
