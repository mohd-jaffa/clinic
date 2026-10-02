import { describe, expect, it } from "vitest";

import {
  addDaysKey,
  addMonthsKey,
  clinicHour,
  dayHour,
  dayKey,
  dayStart,
  daysFrom,
  financialYear,
  monthStartKey,
  monthWeeks,
  nextDayKey,
  todayKey,
  weekStartKey,
} from "@/lib/dates/calendar";

describe("dayKey", () => {
  it("answers in the clinic's timezone, not the browser's", () => {
    // 19:00 UTC on the 21st is already the 22nd in India (+05:30).
    expect(dayKey("2026-09-21T19:00:00Z")).toBe("2026-09-22");
  });

  it("is empty for something that is not a date", () => {
    expect(dayKey("not a date")).toBe("");
  });
});

describe("nextDayKey", () => {
  it("steps to the next day, across a month end", () => {
    expect(nextDayKey("2026-09-30")).toBe("2026-10-01");
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
  });
});

describe("todayKey", () => {
  it("is the day the given instant falls on", () => {
    expect(todayKey(new Date("2026-09-22T06:00:00Z"))).toBe("2026-09-22");
  });
});

describe("the clinic's calendar arithmetic", () => {
  it("moves a day forward and back, across months and years", () => {
    expect(addDaysKey("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(nextDayKey("2026-02-28")).toBe("2026-03-01");
  });

  it("starts a day at India's midnight", () => {
    expect(dayStart("2026-09-22")).toBe("2026-09-21T18:30:00.000Z");
  });

  it("finds an hour of a day in India: its morning, for a reminder", () => {
    expect(dayHour("2026-09-22", 8)).toBe("2026-09-22T02:30:00.000Z");
    expect(dayHour("2026-09-22", 23)).toBe("2026-09-22T17:30:00.000Z");
  });

  it("finds the Monday of a week and the first of a month", () => {
    expect(weekStartKey("2026-09-26")).toBe("2026-09-21"); // a Saturday
    expect(weekStartKey("2026-09-21")).toBe("2026-09-21"); // a Monday
    expect(weekStartKey("2026-09-27")).toBe("2026-09-21"); // a Sunday
    expect(monthStartKey("2026-09-26")).toBe("2026-09-01");
  });

  it("lists every day between two, both included", () => {
    expect(daysFrom("2026-09-29", "2026-10-01")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(daysFrom("2026-09-29", "2026-09-28")).toEqual([]);
  });

  it("reads the hour on the clinic's clock, not the server's", () => {
    expect(clinicHour(new Date("2026-09-22T06:00:00Z"))).toBe(11);
    expect(clinicHour(new Date("2026-09-22T18:40:00Z"))).toBe(0);
  });
});

describe("addMonthsKey", () => {
  it("moves by months, keeping the date inside a shorter month", () => {
    expect(addMonthsKey("2026-09-20", 1)).toBe("2026-10-20");
    expect(addMonthsKey("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsKey("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsKey("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonthsKey("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsKey("2026-09-20", -12)).toBe("2025-09-20");
  });
});

describe("monthWeeks", () => {
  it("lays a month out in weeks from Monday, empty before its first day and after its last", () => {
    const weeks = monthWeeks("2026-09-20");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      null,
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
    expect(weeks[4]).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", null, null, null, null]);
  });

  it("takes six weeks when the month needs them, and four when it fits them exactly", () => {
    expect(monthWeeks("2026-08-01")).toHaveLength(6);
    expect(monthWeeks("2021-02-10")).toHaveLength(4);
    expect(monthWeeks("2021-02-10")[0][0]).toBe("2021-02-01");
  });
});

describe("financialYear", () => {
  it("runs April to March, as Indian bill numbers count it (plan D27)", () => {
    expect(financialYear("2026-04-01")).toBe("2026-27");
    expect(financialYear("2027-03-31")).toBe("2026-27");
    expect(financialYear("2027-04-01")).toBe("2027-28");
    expect(financialYear("2026-01-15")).toBe("2025-26");
  });

  it("writes the century's turn as two digits", () => {
    expect(financialYear("2099-12-31")).toBe("2099-00");
  });
});
