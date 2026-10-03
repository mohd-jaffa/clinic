import { describe, expect, it } from "vitest";

import { ERROR_MESSAGES, getErrorMessage, isErrorMessageCode, MAIL_TEXT, UI_TEXT } from "@/constants/messages";

describe("the app's words", () => {
  it("names the app through one constant (plan D35)", () => {
    expect(UI_TEXT.appName).toBe("ClinicDesk");
    expect(UI_TEXT.appDescription).toBeTruthy();
  });

  it("knows its own error codes, and nothing else — not even an object's own keys", () => {
    expect(isErrorMessageCode("CONFLICT")).toBe(true);
    for (const code of ["NOPE", "toString", "", null, undefined]) expect(isErrorMessageCode(code)).toBe(false);
  });

  it("reads an unknown code as a failure of our own, never as its raw text", () => {
    expect(getErrorMessage("CLINIC_PLAN_EXPIRED")).toBe(ERROR_MESSAGES.CLINIC_PLAN_EXPIRED);
    expect(getErrorMessage("relation patients does not exist")).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });

  it("counts a catalogue in the singular and the plural", () => {
    expect([1, 4].map(UI_TEXT.priceList.count)).toEqual(["1 service", "4 services"]);
    expect([1, 4].map(UI_TEXT.appointmentTypes.count)).toEqual(["1 kind of visit", "4 kinds of visit"]);
    expect([1, 4].map(UI_TEXT.expenseCategories.count)).toEqual(["1 category", "4 categories"]);
  });

  it("counts the team, and an invite's days", () => {
    expect([1, 4].map(UI_TEXT.team.count)).toEqual(["1 person", "4 people"]);
    expect([1, 7].map(MAIL_TEXT.invite.linkValid)).toEqual(["The link works for 1 day.", "The link works for 7 days."]);
  });

  it("counts holidays and leave coming up, and their days", () => {
    expect([0, 3].map(UI_TEXT.closures.count)).toEqual(["None coming up", "3 coming up"]);
    expect([1, 3].map(UI_TEXT.closures.days)).toEqual(["1 day", "3 days"]);
  });
});
