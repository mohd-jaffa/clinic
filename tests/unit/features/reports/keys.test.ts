import { describe, expect, it } from "vitest";

import { dailyReportKey, monthlyReportKey } from "@/features/reports/keys";

describe("the reports' keys (plan §18)", () => {
  it("names a day's report by its day, and a month's by its first day", () => {
    expect(dailyReportKey("2026-10-27")).toBe("/api/reports/daily?day=2026-10-27");
    expect(monthlyReportKey("2026-10-01")).toBe("/api/reports/monthly?month=2026-10-01");
  });
});
