import { describe, expect, it } from "vitest";

import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { consoleClinicsQuerySchema, extendPlanSchema, type ExtendPlanInput } from "@/lib/validation";

describe("consoleClinicsQuerySchema (plan §20.2)", () => {
  it("reads what was typed, one filter and where the page starts", () => {
    expect(consoleClinicsQuerySchema.parse({ search: "  Smile  Care ", filter: "NO_TRIAL", cursor: "20" })).toEqual({
      search: "Smile Care",
      filter: "NO_TRIAL",
      cursor: 20,
    });
    expect(consoleClinicsQuerySchema.parse({})).toEqual({ search: null, filter: undefined, cursor: undefined });
  });

  it("refuses a filter it does not know, in the app's words", () => {
    const result = consoleClinicsQuerySchema.safeParse({ filter: "PAID" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("That value is not valid.");
  });
});

/** A month paid for by UPI today, as the sheet starts. */
const month: ExtendPlanInput = {
  kind: "MONTHLY",
  amount: "300",
  paidOn: todayKey(),
  method: "UPI",
  reference: " UPI-4821 ",
  validUntil: "",
  reason: "",
};

/** What each field was refused with. */
const refusals = (input: ExtendPlanInput) =>
  Object.fromEntries(
    (extendPlanSchema.safeParse(input).error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
  );

describe("extendPlanSchema (plan §7.4; D373, D374)", () => {
  it("reads a month or a year paid for: the amount in paise, how and when, and its reference", () => {
    expect(extendPlanSchema.parse(month)).toEqual({
      kind: "MONTHLY",
      amountPaise: 30_000,
      method: "UPI",
      paidOn: todayKey(),
      reference: "UPI-4821",
      validUntil: null,
      reason: null,
    });
    // A day typed for Set date before Yearly was chosen is not sent; a reason is kept.
    expect(
      extendPlanSchema.parse({
        ...month,
        kind: "YEARLY",
        amount: "3,000",
        validUntil: "2027-01-01",
        reason: "Paid ahead",
      }),
    ).toMatchObject({ kind: "YEARLY", amountPaise: 300_000, validUntil: null, reason: "Paid ahead" });
  });

  it("holds a month or a year to money received (D374): more than ₹0, paid today or before", () => {
    expect(refusals({ ...month, amount: "" })).toEqual({ amount: "Amount needs a value." });
    expect(refusals({ ...month, amount: "0" })).toEqual({ amount: "Amount must be more than 0." });
    expect(refusals({ ...month, paidOn: "" })).toEqual({ paidOn: "Paid on needs a value." });
    expect(refusals({ ...month, paidOn: addDaysKey(todayKey(), 1) })).toEqual({
      paidOn: "Paid on can’t be after today.",
    });
  });

  it("reads a date set free with its reason, sending no payment details (D374)", () => {
    const given = addDaysKey(todayKey(), 10);
    expect(
      extendPlanSchema.parse({
        ...month,
        kind: "CUSTOM",
        amount: "0",
        validUntil: given,
        reason: " Ten days for the move ",
      }),
    ).toEqual({
      kind: "CUSTOM",
      amountPaise: 0,
      method: null,
      paidOn: null,
      reference: null,
      validUntil: given,
      reason: "Ten days for the move",
    });
    expect(
      extendPlanSchema.parse({ ...month, kind: "CUSTOM", amount: "", validUntil: given, reason: "Free" }),
    ).toMatchObject({ amountPaise: 0, method: null });
  });

  it("reads a date set for money, with how and when it was paid", () => {
    expect(
      extendPlanSchema.parse({
        ...month,
        kind: "CUSTOM",
        amount: "1,000",
        validUntil: "2027-03-31",
        reason: "To March",
      }),
    ).toMatchObject({ amountPaise: 100_000, method: "UPI", paidOn: todayKey(), reference: "UPI-4821" });
  });

  it("asks a date set by hand for its day and its reason", () => {
    expect(refusals({ ...month, kind: "CUSTOM", amount: "0", validUntil: "", reason: "" })).toEqual({
      validUntil: "New last day needs a value.",
      reason: "Reason needs a value.",
    });
    expect(refusals({ ...month, kind: "CUSTOM", amount: "0", validUntil: "2027-02-30", reason: "x" })).toEqual({
      validUntil: "New last day must be a date.",
    });
  });

  it("refuses a kind or a method it does not know, in the app's words", () => {
    expect(refusals({ ...month, kind: "WEEKLY" as never })).toMatchObject({ kind: "That value is not valid." });
    expect(refusals({ ...month, method: "CHEQUE" as never })).toMatchObject({ method: "Choose method." });
  });
});
