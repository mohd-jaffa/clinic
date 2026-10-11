import { describe, expect, it } from "vitest";

import { closuresOn, firstDoctorFilter, gridHours, isLive, minutesOf, weekOf } from "@/features/appointments/calendar";
import { aClosure } from "@tests/support/clinic";

/** An appointment at a time on the clinic's clock (+05:30), so long. */
const at = (time: string, minutes = 15) => ({ scheduledAt: `2026-10-13T${time}:00+05:30`, minutes });

describe("firstDoctorFilter (D155)", () => {
  it("opens a doctor on their own appointments, anyone else on every doctor's", () => {
    expect(firstDoctorFilter({ role: "DOCTOR", doctorId: "d-1" })).toBe("d-1");
    expect(firstDoctorFilter({ role: "DOCTOR", doctorId: null })).toBe("");
    expect(firstDoctorFilter({ role: "OWNER", doctorId: "d-2" })).toBe("");
    expect(firstDoctorFilter({ role: "STAFF", doctorId: null })).toBe("");
  });
});

describe("weekOf (D158)", () => {
  it("is the Monday to Sunday a day falls in", () => {
    expect(weekOf("2026-10-13")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(weekOf("2026-10-18")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  });
});

describe("isLive (D153)", () => {
  it("keeps what is still happening, and folds the cancelled and the no-shows away", () => {
    expect(isLive("SCHEDULED")).toBe(true);
    expect(isLive("COMPLETED")).toBe(true);
    expect(isLive("CANCELLED")).toBe(false);
    expect(isLive("NO_SHOW")).toBe(false);
  });
});

describe("minutesOf", () => {
  it("is where an appointment starts and ends on its day's clock", () => {
    expect(minutesOf(at("10:30", 45))).toEqual({ start: 630, end: 675 });
  });
});

describe("gridHours (D152)", () => {
  it("runs 8 AM to 8 PM, reaching to the hour around anything outside them, never past midnight", () => {
    expect(gridHours([])).toEqual({ from: 480, to: 1200 });
    expect(gridHours([at("10:00")])).toEqual({ from: 480, to: 1200 });
    expect(gridHours([at("07:15"), at("20:30", 20)])).toEqual({ from: 420, to: 1260 });
    expect(gridHours([at("23:30", 60)])).toEqual({ from: 480, to: 1440 });
  });
});

describe("closuresOn", () => {
  it("finds the clinic's holiday and each doctor's leave a day falls in", () => {
    const holiday = aClosure({ id: "h", doctorId: null, startsOn: "2026-10-20", endsOn: "2026-10-22" });
    const leave = aClosure({ id: "l", doctorId: "d-1", startsOn: "2026-10-22", endsOn: "2026-10-23" });
    const on = closuresOn([holiday, leave], "2026-10-22");
    expect(on.clinic).toBe(holiday);
    expect(on.leave("d-1")).toBe(leave);
    expect(on.leave("d-2")).toBeUndefined();
    expect(on.all).toEqual([holiday, leave]);
    expect(closuresOn([holiday, leave], "2026-10-24")).toMatchObject({ clinic: undefined, all: [] });
  });
});
