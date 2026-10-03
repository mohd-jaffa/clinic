import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describePatient } from "@/features/patients/describe";

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
