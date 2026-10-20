import { describe, expect, it } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  billsQuerySchema,
  firstIssue,
  noChargeSchema,
  toBillCountQuerySchema,
  toBillQuerySchema,
} from "@/lib/validation";

const DOCTOR = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const messageOf = (result: { success: boolean; error?: Parameters<typeof firstIssue>[0] }) =>
  result.success ? null : firstIssue(result.error!);

describe("toBillQuerySchema and toBillCountQuerySchema (D318, D337)", () => {
  it("reads one doctor, or none for every doctor, and where the page starts", () => {
    expect(toBillQuerySchema.parse({ doctorId: DOCTOR, cursor: "20" })).toEqual({ doctorId: DOCTOR, cursor: 20 });
    expect(toBillQuerySchema.parse({})).toEqual({ doctorId: undefined, cursor: undefined });
    expect(toBillCountQuerySchema.parse({ doctorId: DOCTOR })).toEqual({ doctorId: DOCTOR });
    expect(toBillCountQuerySchema.safeParse({ doctorId: "maya" }).success).toBe(false);
  });
});

describe("noChargeSchema (plan §15.6; D319)", () => {
  it("takes a review or a courtesy as it is, and Other with its note", () => {
    expect(noChargeSchema.parse({ reason: "REVIEW", note: "" })).toEqual({ reason: "REVIEW", note: null });
    expect(noChargeSchema.parse({ reason: "OTHER", note: " Staff  family " })).toEqual({
      reason: "OTHER",
      note: "Staff family",
    });
  });

  it("asks why, and a note for Other, within its bound", () => {
    expect(messageOf(noChargeSchema.safeParse({ reason: "", note: "" }))).toBe(VALIDATION_MESSAGES.choose("Why"));
    expect(messageOf(noChargeSchema.safeParse({ reason: "OTHER", note: " " }))).toBe(
      VALIDATION_MESSAGES.required("Note"),
    );
    expect(noChargeSchema.safeParse({ reason: "OTHER", note: "a".repeat(TEXT_LIMITS.reason + 1) }).success).toBe(false);
  });
});

describe("billsQuerySchema (D320)", () => {
  it("reads the days, a state or none, and where the page starts", () => {
    expect(billsQuerySchema.parse({ from: "2026-10-01", to: "2026-10-19", state: "VOID", cursor: "20" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-19",
      state: "VOID",
      cursor: 20,
    });
    expect(billsQuerySchema.parse({ from: "2026-10-19", to: "2026-10-19" })).toEqual({
      from: "2026-10-19",
      to: "2026-10-19",
      state: undefined,
      cursor: undefined,
    });
    expect(billsQuerySchema.safeParse({ from: "2026-10-19", to: "2026-10-19", state: "LATE" }).success).toBe(false);
  });
});
