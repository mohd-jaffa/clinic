import { describe, expect, it } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  followUpContactFormSchema,
  followUpContactSchema,
  followUpListQuerySchema,
  firstIssue,
} from "@/lib/validation";

const TREATMENT = "11111111-1111-4111-8111-111111111111";
const typed = { kind: "TREATMENT", id: TREATMENT, outcome: "NO_ANSWER", note: "  Line   busy ", snoozeUntil: "" };
const messageOf = (result: { success: boolean; error?: Parameters<typeof firstIssue>[0] }) =>
  result.success ? null : firstIssue(result.error!);

describe("followUpListQuerySchema (plan §14.3)", () => {
  it("takes one of the tabs, and where its page starts", () => {
    expect(followUpListQuerySchema.parse({ tab: "LAPSED", cursor: "20" })).toEqual({ tab: "LAPSED", cursor: 20 });
    expect(followUpListQuerySchema.parse({ tab: "TODAY" })).toEqual({ tab: "TODAY", cursor: undefined });
    expect(messageOf(followUpListQuerySchema.safeParse({ tab: "SOMEDAY" }))).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("followUpContactSchema (plan §14.3; D271, D273, D274)", () => {
  it("reads which follow-up, how it went, a note tidied as any line, and no day to be reminded on", () => {
    expect(followUpContactSchema.parse(typed)).toEqual({
      kind: "TREATMENT",
      id: TREATMENT,
      outcome: "NO_ANSWER",
      note: "Line busy",
      snoozeUntil: null,
    });
    expect(followUpContactSchema.parse({ ...typed, note: "", snoozeUntil: "2026-10-22" })).toMatchObject({
      note: null,
      snoozeUntil: "2026-10-22",
    });
  });

  it("asks how it went, holds the note to its column, and refuses a day that is not one", () => {
    expect(messageOf(followUpContactSchema.safeParse({ ...typed, outcome: "" }))).toBe(
      VALIDATION_MESSAGES.choose("How it went"),
    );
    expect(
      messageOf(followUpContactSchema.safeParse({ ...typed, note: "x".repeat(TEXT_LIMITS.contactNote + 1) })),
    ).toBe(VALIDATION_MESSAGES.tooLong("Note", TEXT_LIMITS.contactNote));
    expect(messageOf(followUpContactSchema.safeParse({ ...typed, snoozeUntil: "2026-02-30" }))).toBe(
      VALIDATION_MESSAGES.day("Remind me on"),
    );
    expect(messageOf(followUpContactSchema.safeParse({ ...typed, kind: "BILL" }))).toBe(VALIDATION_MESSAGES.invalid);
    expect(messageOf(followUpContactSchema.safeParse({ ...typed, id: "t-1" }))).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("followUpContactFormSchema (D271)", () => {
  it("takes a day to be reminded on only after today, as the database does", () => {
    const form = followUpContactFormSchema("2026-10-15");
    expect(form.parse({ ...typed, snoozeUntil: "2026-10-16" }).snoozeUntil).toBe("2026-10-16");
    expect(form.parse(typed).snoozeUntil).toBeNull();
    const refused = form.safeParse({ ...typed, snoozeUntil: "2026-10-15" });
    expect(messageOf(refused)).toBe(VALIDATION_MESSAGES.afterToday("Remind me on"));
    expect(refused.error!.issues[0].path).toEqual(["snoozeUntil"]);
  });
});
