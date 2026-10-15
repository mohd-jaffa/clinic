import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describePatient, lastVisitLine } from "@/features/patients/describe";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("describePatient (plan §10.2)", () => {
  it("says age, gender and number — enough to tell a family apart", () => {
    expect(describePatient({ dateOfBirth: "1991-06-14", gender: "FEMALE", number: 1007 })).toBe(
      "35 y · Female · P-1007",
    );
    expect(describePatient({ dateOfBirth: "2026-02-03", gender: "OTHER", number: 1008 })).toBe("8 mo · Other · P-1008");
  });
});

describe("lastVisitLine (D228, D229)", () => {
  it("says today, the day this year, or the day and year another year", () => {
    expect(lastVisitLine("2026-10-03")).toBe("Last visit: today");
    expect(lastVisitLine("2026-09-28")).toBe("Last visit: 28 Sep");
    expect(lastVisitLine("2025-12-30")).toBe("Last visit: 30 Dec 2025");
    expect(lastVisitLine("2026-10-02", "2026-10-02")).toBe("Last visit: today");
  });

  it("says nothing for a patient never seen", () => {
    expect(lastVisitLine(null)).toBeNull();
  });
});
