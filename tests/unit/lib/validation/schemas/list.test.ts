import { describe, expect, it } from "vitest";

import { MAX_PAGE_START, MAX_RANGE_DAYS, MAX_SEARCH_LENGTH } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import { dayRangeQuery, firstIssue, listQuerySchema, pageQuerySchema, timelineQuerySchema } from "@/lib/validation";

describe("listQuerySchema", () => {
  it("starts at the beginning with no search", () => {
    expect(listQuerySchema.parse({})).toEqual({ cursor: undefined, search: null });
  });

  it("reads the cursor as the row a page starts at, and tidies the search", () => {
    expect(listQuerySchema.parse({ cursor: "40", search: "  Anu   Sharma " })).toEqual({
      cursor: 40,
      search: "Anu Sharma",
    });
  });

  it("refuses a cursor that is not a place in a list", () => {
    for (const cursor of ["-1", "abc", "1.5", "1000000", "200000"]) {
      const result = listQuerySchema.safeParse({ cursor });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result.error)).toBe(VALIDATION_MESSAGES.invalid);
    }
  });

  it("bounds the search", () => {
    const result = listQuerySchema.safeParse({ search: "a".repeat(MAX_SEARCH_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});

describe("timelineQuerySchema (D225)", () => {
  it("reads where a page of the history starts: how many visits and appointments are shown", () => {
    expect(timelineQuerySchema.parse({})).toEqual({ cursor: undefined });
    expect(timelineQuerySchema.parse({ cursor: "12.8" })).toEqual({ cursor: { visits: 12, appointments: 8 } });
    expect(timelineQuerySchema.parse({ cursor: `${MAX_PAGE_START}.0` }).cursor).toEqual({
      visits: MAX_PAGE_START,
      appointments: 0,
    });
  });

  it("refuses anything else rather than reading it as the start", () => {
    for (const cursor of ["x", "20", "1.2.3", "-1.2", "1.", `${MAX_PAGE_START + 1}.0`, `0.${MAX_PAGE_START + 1}`]) {
      const parsed = timelineQuerySchema.safeParse({ cursor });
      expect(parsed.success, cursor).toBe(false);
      expect(firstIssue(parsed.error!)).toBe(VALIDATION_MESSAGES.invalid);
    }
  });
});

describe("pageQuerySchema", () => {
  it("reads where a page starts, and nothing else", () => {
    expect(pageQuerySchema.parse({})).toEqual({ cursor: undefined });
    expect(pageQuerySchema.parse({ cursor: "20", search: "Anu" })).toEqual({ cursor: 20 });
  });
});

describe("dayRangeQuery (D320)", () => {
  const messageOf = (value: unknown) => {
    const result = dayRangeQuery.safeParse(value);
    return result.success ? null : firstIssue(result.error);
  };

  it("reads two days of the calendar, the last on or after the first", () => {
    expect(dayRangeQuery.parse({ from: "2026-10-01", to: "2026-10-19" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-19",
    });
    expect(dayRangeQuery.parse({ from: "2026-10-19", to: "2026-10-19" })).toEqual({
      from: "2026-10-19",
      to: "2026-10-19",
    });
  });

  it("refuses a day missing or not of the calendar, the last before the first, and more than a year and a day", () => {
    expect(messageOf({ to: "2026-10-19" })).toBe(VALIDATION_MESSAGES.required("From"));
    expect(messageOf({ from: "2026-02-30", to: "2026-03-01" })).toBe(VALIDATION_MESSAGES.day("From"));
    expect(messageOf({ from: "2026-10-19", to: "2026-10-01" })).toBe(VALIDATION_MESSAGES.endsBeforeStart("To", "From"));
    expect(messageOf({ from: "2025-10-19", to: "2026-10-19" })).toBeNull();
    expect(messageOf({ from: "2025-10-18", to: "2026-10-19" })).toBe(
      VALIDATION_MESSAGES.atMostRangeDays(MAX_RANGE_DAYS),
    );
  });
});
