import { describe, expect, it } from "vitest";

import { periodEnd, readOnlyFrom, standingOf, subscriptionState } from "@/features/subscription/state";

/** A plan whose last day is 12 November, warned 7 days ahead, with 7 days of grace. */
const plan = { validUntil: "2026-11-12", warningDays: 7, graceDays: 7 };

describe("subscriptionState (plan §7.2)", () => {
  it("is ACTIVE until the warning starts", () => {
    expect(subscriptionState({ ...plan, today: "2026-10-01" })).toBe("ACTIVE");
    expect(subscriptionState({ ...plan, today: "2026-11-05" })).toBe("ACTIVE");
  });

  it("is EXPIRING through the warning, the last day included", () => {
    expect(subscriptionState({ ...plan, today: "2026-11-06" })).toBe("EXPIRING");
    expect(subscriptionState({ ...plan, today: "2026-11-12" })).toBe("EXPIRING");
  });

  it("is GRACE after the last day, through the grace", () => {
    expect(subscriptionState({ ...plan, today: "2026-11-13" })).toBe("GRACE");
    expect(subscriptionState({ ...plan, today: "2026-11-19" })).toBe("GRACE");
  });

  it("is READ_ONLY from the day after the grace", () => {
    expect(subscriptionState({ ...plan, today: "2026-11-20" })).toBe("READ_ONLY");
    expect(subscriptionState({ ...plan, today: "2027-01-01" })).toBe("READ_ONLY");
  });

  it("skips what the settings set to nothing: no warning, no grace", () => {
    const none = { ...plan, warningDays: 0, graceDays: 0 };
    expect(subscriptionState({ ...none, today: "2026-11-12" })).toBe("ACTIVE");
    expect(subscriptionState({ ...none, today: "2026-11-13" })).toBe("READ_ONLY");
  });

  it("counts across a month's and a year's end", () => {
    const yearEnd = { validUntil: "2026-12-31", warningDays: 7, graceDays: 7 };
    expect(subscriptionState({ ...yearEnd, today: "2026-12-24" })).toBe("ACTIVE");
    expect(subscriptionState({ ...yearEnd, today: "2027-01-07" })).toBe("GRACE");
    expect(subscriptionState({ ...yearEnd, today: "2027-01-08" })).toBe("READ_ONLY");
  });
});

describe("readOnlyFrom", () => {
  it("is the day after the grace ends", () => {
    expect(readOnlyFrom("2026-11-12", 7)).toBe("2026-11-20");
    expect(readOnlyFrom("2026-11-12", 0)).toBe("2026-11-13");
    expect(readOnlyFrom("2026-12-31", 1)).toBe("2027-01-02");
  });
});

describe("standingOf (plan §7.2)", () => {
  it("tells a plan's state on a day by the live settings, and its first view-only day", () => {
    const settings = { expiryWarningDays: 7, graceDays: 7 };
    expect(standingOf({ plan: "MONTHLY", validUntil: "2026-11-12" }, settings, "2026-11-08")).toEqual({
      plan: "MONTHLY",
      validUntil: "2026-11-12",
      state: "EXPIRING",
      readOnlyFrom: "2026-11-20",
    });
    expect(
      standingOf({ plan: "TRIAL", validUntil: "2026-11-12" }, { ...settings, graceDays: 0 }, "2026-11-13"),
    ).toEqual({ plan: "TRIAL", validUntil: "2026-11-12", state: "READ_ONLY", readOnlyFrom: "2026-11-13" });
  });
});

describe("periodEnd (plan §7.4)", () => {
  it("runs on from the plan's last day when paid early, so no day is lost", () => {
    expect(periodEnd("MONTHLY", "2026-11-12", "2026-10-30")).toBe("2026-12-12");
    expect(periodEnd("YEARLY", "2026-11-12", "2026-10-30")).toBe("2027-11-12");
  });

  it("runs on from yesterday when paid late, or on the last day, so the period starts today", () => {
    expect(periodEnd("MONTHLY", "2026-09-01", "2026-10-30")).toBe("2026-11-29");
    expect(periodEnd("MONTHLY", "2026-10-29", "2026-10-30")).toBe("2026-11-29");
    expect(periodEnd("MONTHLY", "2026-10-30", "2026-10-30")).toBe("2026-11-30");
  });

  it("keeps a month's end inside a shorter month", () => {
    expect(periodEnd("MONTHLY", "2027-01-31", "2026-10-30")).toBe("2027-02-28");
    expect(periodEnd("YEARLY", "2028-02-29", "2026-10-30")).toBe("2029-02-28");
  });
});
