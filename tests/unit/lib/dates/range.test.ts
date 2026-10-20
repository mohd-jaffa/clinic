import { afterEach, describe, expect, it, vi } from "vitest";

import { presetRange, rangeBounds, todayRange } from "@/lib/dates/range";

afterEach(() => {
  vi.useRealTimers();
});

describe("presetRange (D320)", () => {
  it("is today, the last 7 days with today, or this month so far, in the clinic's calendar", () => {
    expect(presetRange("TODAY", "2026-10-19")).toEqual({ from: "2026-10-19", to: "2026-10-19" });
    expect(presetRange("WEEK", "2026-10-03")).toEqual({ from: "2026-09-27", to: "2026-10-03" });
    expect(presetRange("MONTH", "2026-10-19")).toEqual({ from: "2026-10-01", to: "2026-10-19" });
  });

  it("counts from the clinic's today when none is given", () => {
    vi.useFakeTimers({ now: new Date("2026-10-18T20:00:00Z") });
    // Half past one in the morning of the 19th in India.
    expect(presetRange("TODAY")).toEqual({ from: "2026-10-19", to: "2026-10-19" });
    expect(todayRange()).toEqual({ kind: "TODAY", from: "2026-10-19", to: "2026-10-19" });
  });
});

describe("rangeBounds", () => {
  it("spans from the first day's midnight in India until the midnight after the last", () => {
    expect(rangeBounds({ from: "2026-10-01", to: "2026-10-19" })).toEqual({
      from: "2026-09-30T18:30:00.000Z",
      to: "2026-10-19T18:30:00.000Z",
    });
  });
});
