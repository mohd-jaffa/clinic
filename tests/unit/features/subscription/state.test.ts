import { describe, expect, it } from "vitest";

import { readOnlyFrom, subscriptionState } from "@/features/subscription/state";

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
