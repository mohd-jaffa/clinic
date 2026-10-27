import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dailyReportQuerySchema, firstIssue, monthlyReportQuerySchema } from "@/lib/validation";

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-27T06:00:00Z"), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

const issue = (schema: typeof dailyReportQuerySchema | typeof monthlyReportQuerySchema, input: unknown) => {
  const parsed = schema.safeParse(input);
  return parsed.success ? null : firstIssue(parsed.error);
};

describe("dailyReportQuerySchema (plan §18; D356)", () => {
  it("takes today or a day before it", () => {
    expect(dailyReportQuerySchema.parse({ day: "2026-10-27" })).toEqual({ day: "2026-10-27" });
    expect(dailyReportQuerySchema.parse({ day: "2025-01-01" })).toEqual({ day: "2025-01-01" });
  });

  it("refuses a day after today, or none", () => {
    expect(issue(dailyReportQuerySchema, { day: "2026-10-28" })).toBe("Day can’t be after today.");
    expect(issue(dailyReportQuerySchema, {})).toBe("Day needs a value.");
  });
});

describe("monthlyReportQuerySchema (plan §18)", () => {
  it("reads any day of a month as its first, this month or one before", () => {
    expect(monthlyReportQuerySchema.parse({ month: "2026-10-27" })).toEqual({ month: "2026-10-01" });
    expect(monthlyReportQuerySchema.parse({ month: "2026-09-30" })).toEqual({ month: "2026-09-01" });
  });

  it("refuses a month after this one", () => {
    expect(issue(monthlyReportQuerySchema, { month: "2026-11-01" })).toBe("Month can’t be after today.");
  });
});
