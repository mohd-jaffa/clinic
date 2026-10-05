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

  it("counts an import's rows as India writes them, in the singular and the plural (plan §10.5)", () => {
    const words = UI_TEXT.patientImport;
    expect([words.chosen("a.csv", 1), words.chosen("a.csv", 12000)]).toEqual(["a.csv · 1 row", "a.csv · 12,000 rows"]);
    expect(words.tooLong(120000, 10000)).toContain("1,20,000 rows; one import takes at most 10,000");
    expect([words.send(1), words.send(1240)]).toEqual(["Import 1 patient", "Import 1,240 patients"]);
    expect(words.willAdd(1)).toMatch(/^1 patient will/);
    expect(words.willAdd(100000)).toMatch(/^1,00,000 patients will/);
    expect(words.willLeave(2, 3)).toBe("2 skipped as duplicates, 3 left out with problems.");
    expect(words.sending(200, 1240)).toBe("Importing… 200 of 1,240");
    expect(words.stopped(200, 1240)).toMatch(/^The import stopped at 200 of 1,240\./);
    expect([words.column("C", "Mobile No."), words.column("D", "")]).toEqual(["C · Mobile No.", "Column D"]);
    expect([words.row(14, "Rohan"), words.row(15, "")]).toEqual(["Row 14 · Rohan", "Row 15"]);
  });
});
