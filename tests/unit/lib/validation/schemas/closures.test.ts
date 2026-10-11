import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { MAX_CLOSURE_DAYS, TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import { closureDaysSchema, closureSchema, firstIssue, WHOLE_CLINIC } from "@/lib/validation";

function messageOf(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : firstIssue(result.error);
}

const DOCTOR = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const holiday = { who: WHOLE_CLINIC, startsOn: "2026-10-20", endsOn: "2026-10-22", reason: " Diwali " };

// Today, in Kochi: 3 October 2026.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("closureSchema (plan §9, D85)", () => {
  it("reads the whole clinic as no doctor, and a doctor as theirs", () => {
    expect(closureSchema.parse(holiday)).toEqual({
      doctorId: null,
      startsOn: "2026-10-20",
      endsOn: "2026-10-22",
      reason: "Diwali",
    });
    expect(closureSchema.parse({ ...holiday, who: DOCTOR })).toMatchObject({ doctorId: DOCTOR });
  });

  it("takes today, a single day, and a run of exactly the longest", () => {
    expect(closureSchema.parse({ ...holiday, startsOn: "2026-10-03", endsOn: "2026-10-03" })).toMatchObject({
      startsOn: "2026-10-03",
    });
    expect(closureSchema.safeParse({ ...holiday, startsOn: "2026-10-03", endsOn: "2027-10-03" }).success).toBe(true);
  });

  it("says what is wrong, in the catalogue's words", () => {
    expect(messageOf(closureSchema, { ...holiday, who: "Dr Rahul" })).toBe(VALIDATION_MESSAGES.choose("Who’s away"));
    expect(messageOf(closureSchema, { ...holiday, startsOn: "" })).toBe(VALIDATION_MESSAGES.required("First day"));
    expect(messageOf(closureSchema, { ...holiday, startsOn: "2026-10-02", endsOn: "2026-10-04" })).toBe(
      VALIDATION_MESSAGES.notBeforeToday("First day"),
    );
    expect(messageOf(closureSchema, { ...holiday, endsOn: "2026-10-19" })).toBe(
      VALIDATION_MESSAGES.endsBeforeStart("Last day", "First day"),
    );
    expect(messageOf(closureSchema, { ...holiday, startsOn: "2026-10-03", endsOn: "2027-10-04" })).toBe(
      VALIDATION_MESSAGES.atMostDays(MAX_CLOSURE_DAYS),
    );
    expect(messageOf(closureSchema, { ...holiday, reason: " " })).toBe(VALIDATION_MESSAGES.required("Reason"));
    expect(messageOf(closureSchema, { ...holiday, reason: "x".repeat(TEXT_LIMITS.closureReason + 1) })).toBe(
      VALIDATION_MESSAGES.tooLong("Reason", TEXT_LIMITS.closureReason),
    );
  });
});

describe("closureDaysSchema (D137)", () => {
  it("reads who and the days as a closure would, without a reason", () => {
    expect(closureDaysSchema.parse({ who: DOCTOR, startsOn: "2026-10-20", endsOn: "2026-10-22" })).toEqual({
      doctorId: DOCTOR,
      startsOn: "2026-10-20",
      endsOn: "2026-10-22",
    });
  });

  it("refuses days a closure could not have", () => {
    expect(
      closureDaysSchema.safeParse({ who: WHOLE_CLINIC, startsOn: "2026-10-01", endsOn: "2026-10-02" }).success,
    ).toBe(false);
    expect(
      closureDaysSchema.safeParse({ who: WHOLE_CLINIC, startsOn: "2026-10-20", endsOn: "2026-10-19" }).success,
    ).toBe(false);
    expect(closureDaysSchema.safeParse({ who: WHOLE_CLINIC, startsOn: "2026-10-20", endsOn: "" }).success).toBe(false);
  });
});
