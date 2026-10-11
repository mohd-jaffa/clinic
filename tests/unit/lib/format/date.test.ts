import { describe, it, expect } from "vitest";
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatDayRange,
  formatDaysAgo,
  formatHour,
  formatLongDate,
  formatMonth,
  formatMonthName,
  formatMonthYear,
  formatRecent,
  formatShortDay,
  formatTime,
} from "@/lib/format/date";

describe("formatDate", () => {
  it("formats ISO calendar dates cleanly", () => {
    expect(formatDate("2026-10-13")).toBe("13 Oct 2026");
  });

  it("returns dash for invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("formats full ISO timestamp to Indian date and time", () => {
    expect(formatDateTime("2026-09-22T10:30:00Z")).toBe("22 Sep 2026, 4:00 PM");
  });

  it("says nothing for a missing or unreadable time", () => {
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("soon")).toBe("—");
  });
});

describe("formatTime", () => {
  it("gives the time of day on the clinic's clock", () => {
    expect(formatTime("2026-09-25T18:20:00Z")).toBe("11:50 PM");
    expect(formatTime("2026-09-26T03:30:00Z")).toBe("9:00 AM");
  });

  it("says nothing for a missing or unreadable time", () => {
    expect(formatTime(null)).toBe("—");
    expect(formatTime("not a time")).toBe("—");
  });
});

describe("formatMonth", () => {
  it("names the month a date falls in, for grouping a list", () => {
    expect(formatMonth("2026-09-22")).toBe("Sep 2026");
  });

  it("returns a dash for nothing", () => {
    expect(formatMonth(null)).toBe("—");
  });
});

describe("formatDayMonth", () => {
  it("drops the year where the year is already obvious", () => {
    expect(formatDayMonth("2026-10-13")).toBe("13 Oct");
  });

  it("returns a dash for nothing", () => {
    expect(formatDayMonth("")).toBe("—");
  });
});

describe("formatLongDate", () => {
  it("names the weekday before the date", () => {
    expect(formatLongDate("2026-09-26")).toBe("Saturday, 26 Sep 2026");
    expect(formatLongDate("2026-09-27")).toBe("Sunday, 27 Sep 2026");
  });

  it("shows a dash for a date it cannot read", () => {
    expect(formatLongDate(undefined)).toBe("—");
    expect(formatLongDate("26/09/2026")).toBe("—");
  });
});

describe("formatDaysAgo", () => {
  const now = new Date("2026-09-26T06:00:00Z"); // 11:30 in India

  it("counts the clinic's days since, in words", () => {
    expect(formatDaysAgo("2026-09-25T20:00:00Z", now)).toBe("today"); // 1:30 on the 26th in India
    expect(formatDaysAgo("2026-09-25T05:00:00Z", now)).toBe("yesterday");
    expect(formatDaysAgo("2026-09-21T05:00:00Z", now)).toBe("5 days ago");
    expect(formatDaysAgo("2026-09-19T05:00:00Z", now)).toBe("a week ago");
    expect(formatDaysAgo("2026-09-05T05:00:00Z", now)).toBe("3 weeks ago");
    expect(formatDaysAgo("2026-08-20T05:00:00Z", now)).toBe("a month ago");
    expect(formatDaysAgo("2026-06-01T05:00:00Z", now)).toBe("3 months ago");
    expect(formatDaysAgo("2025-09-01T05:00:00Z", now)).toBe("a year ago");
    expect(formatDaysAgo("2023-09-01T05:00:00Z", now)).toBe("3 years ago");
  });

  it("never reads a later instant as the future", () => {
    expect(formatDaysAgo("2026-09-28T05:00:00Z", now)).toBe("today");
  });
});

describe("formatRecent", () => {
  const now = new Date("2026-09-26T06:00:00Z"); // 11:30 in India

  it("gives the time for something today, on the clinic's clock", () => {
    expect(formatRecent("2026-09-26T04:54:00Z", now)).toBe("10:24 AM");
  });

  it("then says how long ago, as a line begins", () => {
    expect(formatRecent("2026-09-25T06:00:00Z", now)).toBe("Yesterday");
    expect(formatRecent("2026-09-23T06:00:00Z", now)).toBe("3 days ago");
    expect(formatRecent("2026-09-12T06:00:00Z", now)).toBe("2 weeks ago");
  });
});

describe("formatMonthName", () => {
  it("names the month short, for a calendar's month grid", () => {
    expect(formatMonthName("2026-09-14")).toBe("Sep");
    expect(formatMonthName(null)).toBe("—");
  });
});

describe("formatMonthYear", () => {
  it("names the month in full, for a calendar", () => {
    expect(formatMonthYear("2026-09-20")).toBe("September 2026");
    expect(formatMonthYear("2026-01")).toBe("January 2026");
  });

  it("shows a dash for nothing", () => {
    expect(formatMonthYear(null)).toBe("—");
    expect(formatMonthYear("soon")).toBe("—");
  });
});

describe("formatClock", () => {
  it("writes a time of day the way the app does", () => {
    expect(formatClock("00:00")).toBe("12:00 AM");
    expect(formatClock("09:15")).toBe("9:15 AM");
    expect(formatClock("12:30")).toBe("12:30 PM");
    expect(formatClock("18:45")).toBe("6:45 PM");
  });

  it("shows a dash for nothing", () => {
    expect(formatClock("")).toBe("—");
    expect(formatClock(undefined)).toBe("—");
    expect(formatClock("6pm")).toBe("—");
  });
});

describe("formatDayRange", () => {
  const today = "2026-10-03";

  it("says a run of days as short as it reads clearly, within this year", () => {
    expect(formatDayRange("2026-10-20", "2026-10-20", today)).toBe("20 Oct");
    expect(formatDayRange("2026-10-20", "2026-10-22", today)).toBe("20 – 22 Oct");
    expect(formatDayRange("2026-10-30", "2026-11-02", today)).toBe("30 Oct – 2 Nov");
  });

  it("adds the year when it is not this one", () => {
    expect(formatDayRange("2027-01-05", "2027-01-05", today)).toBe("5 Jan 2027");
    expect(formatDayRange("2027-01-05", "2027-01-07", today)).toBe("5 – 7 Jan 2027");
    expect(formatDayRange("2025-11-30", "2025-12-02", today)).toBe("30 Nov – 2 Dec 2025");
    expect(formatDayRange("2026-12-28", "2027-01-03", today)).toBe("28 Dec 2026 – 3 Jan 2027");
  });

  it("is a dash for days it cannot read, and counts this year from today by default", () => {
    expect(formatDayRange("soon", "2026-10-20", today)).toBe("—");
    expect(formatDayRange("2026-10-20", "", today)).toBe("—");
    const year = new Date().getFullYear();
    expect(formatDayRange(`${year}-06-01`, `${year}-06-02`)).toBe("1 – 2 Jun");
  });
});

describe("formatHour", () => {
  it("writes an hour of the clock the way the app does", () => {
    expect(formatHour("00")).toBe("12 AM");
    expect(formatHour("09")).toBe("9 AM");
    expect(formatHour("12")).toBe("12 PM");
    expect(formatHour("18")).toBe("6 PM");
  });
});

describe("formatShortDay", () => {
  it("writes a day short, for a message", () => {
    expect(formatShortDay("2026-10-14")).toBe("Wed 14 Oct");
    expect(formatShortDay("2026-10-11")).toBe("Sun 11 Oct");
    expect(formatShortDay(null)).toBe("—");
  });
});
