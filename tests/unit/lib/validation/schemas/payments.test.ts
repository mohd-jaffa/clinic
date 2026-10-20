import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  firstIssue,
  paymentIdSchema,
  paymentSchema,
  paymentsQuerySchema,
  voidPaymentSchema,
  type PaymentInput,
} from "@/lib/validation";

const PATIENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const typed: PaymentInput = {
  patientId: PATIENT,
  kind: "PAYMENT",
  amount: "₹1,200",
  paidOn: "2026-10-19",
  method: "UPI",
  reference: "  UTR   42 ",
  note: "",
};
const messageOf = (result: { success: boolean; error?: Parameters<typeof firstIssue>[0] }) =>
  result.success ? null : firstIssue(result.error!);

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("paymentSchema (plan §15.3; D299, D334)", () => {
  it("reads the amount into paise and tidies the lines; blank is none", () => {
    expect(paymentSchema.parse(typed)).toEqual({
      patientId: PATIENT,
      kind: "PAYMENT",
      amountPaise: 120_000,
      paidOn: "2026-10-19",
      method: "UPI",
      reference: "UTR 42",
      note: null,
    });
    expect(paymentSchema.parse({ ...typed, kind: "REFUND", paidOn: "2026-10-01" })).toMatchObject({
      kind: "REFUND",
      paidOn: "2026-10-01",
    });
  });

  it("refuses nothing paid, a day after today, no method, and lines too long", () => {
    expect(messageOf(paymentSchema.safeParse({ ...typed, amount: "0" }))).toBe(
      VALIDATION_MESSAGES.moreThanZero("Amount"),
    );
    expect(messageOf(paymentSchema.safeParse({ ...typed, paidOn: "2026-10-20" }))).toBe(
      VALIDATION_MESSAGES.notAfterToday("Paid on"),
    );
    expect(messageOf(paymentSchema.safeParse({ ...typed, method: "" }))).toBe(VALIDATION_MESSAGES.choose("Method"));
    expect(messageOf(paymentSchema.safeParse({ ...typed, kind: "GIFT" }))).toBe(VALIDATION_MESSAGES.invalid);
    expect(paymentSchema.safeParse({ ...typed, note: "a".repeat(TEXT_LIMITS.paymentNote + 1) }).success).toBe(false);
    expect(messageOf(paymentSchema.safeParse({ ...typed, patientId: "" }))).toBe(VALIDATION_MESSAGES.choose("Patient"));
  });
});

describe("voidPaymentSchema (D336)", () => {
  it("asks a reason, tidied and bounded", () => {
    expect(voidPaymentSchema.parse({ reason: " Entered  twice " })).toEqual({ reason: "Entered twice" });
    expect(messageOf(voidPaymentSchema.safeParse({ reason: " " }))).toBe(VALIDATION_MESSAGES.required("Reason"));
  });
});

describe("paymentIdSchema and paymentsQuerySchema (D320)", () => {
  it("reads a payment's id, and the Payments tab's days and page", () => {
    expect(paymentIdSchema.safeParse(PATIENT).success).toBe(true);
    expect(paymentIdSchema.safeParse("pay-1").success).toBe(false);
    expect(paymentsQuerySchema.parse({ from: "2026-10-01", to: "2026-10-19", cursor: "20" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-19",
      cursor: 20,
    });
    expect(paymentsQuerySchema.safeParse({ from: "2026-10-19", to: "2026-10-01" }).success).toBe(false);
  });
});
