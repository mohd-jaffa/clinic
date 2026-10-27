import { describe, expect, it } from "vitest";

import { outcomesOf } from "@/features/reports/outcomes";

describe("outcomesOf (plan §18; D355)", () => {
  it("gathers the month's statuses into four parts, in the donut's order", () => {
    expect(
      outcomesOf({ COMPLETED: 160, SCHEDULED: 6, CONFIRMED: 4, ARRIVED: 1, IN_PROGRESS: 2, NO_SHOW: 8, CANCELLED: 12 }),
    ).toEqual([
      { outcome: "COMPLETED", count: 160 },
      { outcome: "STILL_TO_COME", count: 13 },
      { outcome: "NO_SHOW", count: 8 },
      { outcome: "CANCELLED", count: 12 },
    ]);
  });

  it("counts a status with none as nothing", () => {
    expect(outcomesOf({}).map((part) => part.count)).toEqual([0, 0, 0, 0]);
  });
});
