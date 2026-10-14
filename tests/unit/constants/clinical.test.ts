import { describe, expect, it } from "vitest";

import { PRESCRIPTION_DAYS, PRESCRIPTION_FREQUENCIES } from "@/constants/clinical";
import { TEXT_LIMITS } from "@/constants/limits";

describe("a prescription's chips and bounds (plan §13, D214, D217)", () => {
  it("offers each frequency once, each one the column can hold", () => {
    expect(new Set(PRESCRIPTION_FREQUENCIES).size).toBe(PRESCRIPTION_FREQUENCIES.length);
    for (const frequency of PRESCRIPTION_FREQUENCIES) {
      expect(frequency.length).toBeLessThanOrEqual(TEXT_LIMITS.frequency);
    }
    expect(PRESCRIPTION_FREQUENCIES).toEqual(expect.arrayContaining(["1-0-1", "1-1-1", "0-0-1", "SOS"]));
  });

  it("takes a medicine for at least a day, and at most a year", () => {
    expect(PRESCRIPTION_DAYS).toEqual({ min: 1, max: 365 });
  });
});
