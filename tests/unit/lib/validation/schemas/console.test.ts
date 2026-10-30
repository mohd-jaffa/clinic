import { describe, expect, it } from "vitest";

import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import {
  consoleClinicsQuerySchema,
  extendPlanSchema,
  platformSettingsSchema,
  type ExtendPlanInput,
} from "@/lib/validation";

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

describe("platformSettingsSchema (plan §6, §20.4; D378 – D380)", () => {
  const refused = (input: Record<string, unknown>) =>
    Object.fromEntries(
      (platformSettingsSchema.safeParse(input).error?.issues ?? []).map((issue) => [
        issue.path.join("."),
        issue.message,
      ]),
    );

  it("reads a group as typed: days and rows as numbers, prices in paise, the email days as a list", () => {
    expect(
      platformSettingsSchema.parse({
        trialDays: "45",
        monthlyPricePaise: "350",
        yearlyPricePaise: "3,500.50",
        expiryNoticeDays: "1, 14 7",
        maxImportRows: "20000",
      }),
    ).toEqual({
      trialDays: 45,
      monthlyPricePaise: 35_000,
      yearlyPricePaise: 350_050,
      expiryNoticeDays: [14, 7, 1],
      maxImportRows: 20_000,
    });
  });

  it("changes only what is sent", () => {
    expect(platformSettingsSchema.parse({})).toEqual({});
    expect(platformSettingsSchema.parse({ graceDays: "0" })).toEqual({ graceDays: 0 });
  });

  it("reads the renewal contact, each part emptied to hide it", () => {
    expect(
      platformSettingsSchema.parse({
        renewalContactName: "  Jaffa  ",
        renewalContactPhone: "98450 12345",
        renewalContactEmail: "renew@clinicdesk.in",
        renewalUpiId: "clinicdesk@okaxis",
      }),
    ).toEqual({
      renewalContactName: "Jaffa",
      renewalContactPhone: "+919845012345",
      renewalContactEmail: "renew@clinicdesk.in",
      renewalUpiId: "clinicdesk@okaxis",
    });
    expect(
      platformSettingsSchema.parse({
        renewalContactName: "",
        renewalContactPhone: "",
        renewalContactEmail: "",
        renewalUpiId: "",
      }),
    ).toEqual({ renewalContactName: null, renewalContactPhone: null, renewalContactEmail: null, renewalUpiId: null });
  });

  it("holds each setting to its bounds, in the setting's own name", () => {
    expect(
      refused({
        trialDays: "366",
        auditKeepDays: "6",
        maxImportRows: "50001",
        monthlyPricePaise: "",
        yearlyPricePaise: "10,00,001",
        expiryNoticeDays: "90",
        renewalContactPhone: "12345",
        renewalUpiId: "pay me",
      }),
    ).toEqual({
      trialDays: "Trial days must be from 0 to 365.",
      auditKeepDays: "Audit kept for (days) must be from 7 to 3650.",
      maxImportRows: "Rows per import must be from 100 to 50000.",
      monthlyPricePaise: "Monthly price needs a value.",
      yearlyPricePaise: "Yearly price can be at most ₹10,00,000.",
      expiryNoticeDays: "Expiry email days must be days from 1 to 60, with commas between.",
      renewalContactPhone: "Enter a valid 10-digit mobile number.",
      renewalUpiId: "UPI id must look like name@bank.",
    });
  });

  it("reads the business details the receipts print, each emptied to leave it out (R11.8)", () => {
    expect(
      platformSettingsSchema.parse({
        businessName: "  ClinicDesk  Software ",
        businessAddress: "12 MG Road  \nKochi 682001 ",
      }),
    ).toEqual({ businessName: "ClinicDesk Software", businessAddress: "12 MG Road\nKochi 682001" });
    expect(platformSettingsSchema.parse({ businessName: "", businessAddress: "" })).toEqual({
      businessName: null,
      businessAddress: null,
    });
  });
});
