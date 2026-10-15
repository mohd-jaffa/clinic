import { describe, expect, it } from "vitest";

import {
  ERROR_MESSAGES,
  getErrorMessage,
  isErrorMessageCode,
  MAIL_TEXT,
  UI_TEXT,
  VALIDATION_MESSAGES,
} from "@/constants/messages";

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

  it("names a prescription's medicines, their days, an allergy, who typed it and what it waits for (D210 – D217)", () => {
    const words = UI_TEXT.prescription;
    expect([words.medicineN(2), words.moveUp(2), words.moveDown(1), words.remove(3)]).toEqual([
      "Medicine 2",
      "Move medicine 2 up",
      "Move medicine 1 down",
      "Remove medicine 3",
    ]);
    expect([1, 5].map(words.days)).toEqual(["1 day", "5 days"]);
    expect(words.allergy("Penicillin, Sulfa")).toBe("Allergy: Penicillin, Sulfa");
    expect(words.allergyConfirmBody(words.allergyLine("Penicillin V", "Penicillin"))).toBe(
      "Penicillin V matches the allergy to Penicillin. Check it before saving.",
    );
    expect(words.typedBy("Priya Nair")).toBe("Typed by Priya Nair");
    expect(words.needsRegistration("Arjun Shah")).toMatch(/^Arjun Shah has no registration number yet/);
    expect(VALIDATION_MESSAGES.atMostMedicines(30)).toBe("A prescription holds at most 30 medicines.");
  });

  it("names a prescription's printout, and what its PDF says (D218 – D224)", () => {
    const words = UI_TEXT.prescription;
    expect([words.printOf("Rohan Mehta"), words.downloadOf("Rohan Mehta")]).toEqual([
      "Print Rohan Mehta’s prescription",
      "Download Rohan Mehta’s prescription",
    ]);
    // An accessible name begins with the label it names.
    expect(words.printOf("Rohan Mehta").startsWith(words.print)).toBe(true);
    expect(words.downloadOf("Rohan Mehta").startsWith(words.download)).toBe(true);
    expect(words.savedAs("a.pdf")).toBe("Saved as “a.pdf”.");

    const documents = UI_TEXT.documents;
    expect(documents.footer).toBe("Generated with ClinicDesk");
    expect(documents.page(2, 3)).toBe("Page 2 of 3");
    expect(documents.running("Rohan Mehta", "36 y · Male · P-1002", "14 Oct 2026")).toBe(
      "Rohan Mehta · 36 y · Male · P-1002 · 14 Oct 2026",
    );
    // "Dr." once, whether or not their name already says it.
    expect(["Maya Rao", "Dr. Maya Rao", "dr Maya Rao", "Drishti Rao"].map(documents.doctor)).toEqual([
      "Dr. Maya Rao",
      "Dr. Maya Rao",
      "dr Maya Rao",
      "Dr. Drishti Rao",
    ]);
    expect(documents.registration("KMC 12345")).toBe("Reg. KMC 12345");
    expect(documents.followUp("Wednesday, 21 Oct 2026")).toBe("Review on Wednesday, 21 Oct 2026");
    expect(documents.prescriptionTitle("Rohan Mehta", "14 Oct 2026")).toBe("Prescription for Rohan Mehta, 14 Oct 2026");
    expect(documents.prescriptionFile("Rohan Mehta", "14 Oct 2026")).toBe(
      "Rohan Mehta - 14 Oct 2026 - Prescription.pdf",
    );
    expect(ERROR_MESSAGES.PRESCRIPTION_EMPTY).toMatch(/no medicines yet/);
    expect(ERROR_MESSAGES.PRESCRIPTION_PDF_FAILED).toMatch(/PDF/);
  });

  it("says what became of a visit, its follow-up and a waiting patient's vitals (D203 – D205)", () => {
    const words = UI_TEXT.visit;
    expect(words.followUpSaved("Tuesday, 20 Oct 2026")).toBe("Review on Tuesday, 20 Oct 2026");
    expect(words.started("Asha Iyer")).toBe("Asha Iyer’s visit started");
    expect(words.openedAgain("Asha Iyer", "Maya Rao")).toBe("Asha Iyer is already in with Maya Rao");
    expect(words.finished("Asha Iyer")).toBe("Asha Iyer’s visit is done");
    expect(words.takeVitalsOf("Asha Iyer")).toBe("Take Asha Iyer’s vitals");
    expect(words.vitalsFor("Asha Iyer")).toBe("Vitals for Asha Iyer");
    expect(words.vitalsSavedFor("Asha Iyer")).toBe("Vitals saved for Asha Iyer");
  });

  it("tells a follow-up's last contact, by whom when it is known, and what became of a contact noted (D271, D275)", () => {
    const words = UI_TEXT.followUps;
    expect(words.lastContactBy("No answer", "14 Oct", "Priya Shah")).toBe("No answer · 14 Oct, by Priya Shah");
    expect(words.lastContactBy("No answer", "14 Oct", null)).toBe("No answer · 14 Oct");
    expect(words.noted("Anita Rao", "Reached")).toBe("Noted for Anita Rao: Reached");
    expect(words.notedUntil("Anita Rao", "No answer", "18 Oct")).toBe(
      "Noted for Anita Rao: No answer. Back on the list on 18 Oct.",
    );
    expect(words.empty.UPCOMING).toBe("No one is due in the next 30 days");
    expect(ERROR_MESSAGES.FOLLOW_UPS_LOAD_FAILED).toMatch(/follow-ups/);
  });
});
