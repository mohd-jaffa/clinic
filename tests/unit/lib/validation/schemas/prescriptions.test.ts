import { describe, expect, it } from "vitest";

import { PRESCRIPTION_MAX_ITEMS, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import {
  medicineSearchSchema,
  prescriptionItemSchema,
  prescriptionSchema,
  savePrescriptionSchema,
  type PrescriptionItemInput,
} from "@/lib/validation";

const D = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const { prescription: words } = UI_TEXT;

const issues = (result: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  result.error?.issues.map(({ message, path }) => ({ message, path: path.join(".") }));

const LINE: PrescriptionItemInput = {
  medicine: "Paracetamol",
  strength: "",
  dose: "",
  frequency: "",
  timing: "",
  durationDays: "",
  instructions: "",
};
const READ = {
  medicine: "Paracetamol",
  strength: null,
  dose: null,
  frequency: null,
  timing: null,
  durationDays: null,
  instructions: null,
};

describe("prescriptionItemSchema (plan §13, D214, D217)", () => {
  it("keeps a medicine's name and what else is written, tidied, blank as none", () => {
    expect(
      prescriptionItemSchema.parse({
        medicine: "  Amoxicillin ​+  Clavulanic acid ",
        strength: " 625 mg ",
        dose: "1 tab",
        frequency: "Once a week",
        timing: "AFTER_FOOD",
        durationDays: " 5 ",
        instructions: " Finish the course ",
      }),
    ).toEqual({
      medicine: "Amoxicillin + Clavulanic acid",
      strength: "625 mg",
      dose: "1 tab",
      frequency: "Once a week",
      timing: "AFTER_FOOD",
      durationDays: 5,
      instructions: "Finish the course",
    });
    expect(prescriptionItemSchema.parse(LINE)).toEqual(READ);
    // What it produced parses again to the same.
    expect(prescriptionItemSchema.parse(READ)).toEqual(READ);
    expect(prescriptionItemSchema.parse({ medicine: "Paracetamol" })).toEqual(READ);
  });

  it("needs a name, and holds each part to its column, the days to 1 – 365", () => {
    expect(issues(prescriptionItemSchema.safeParse({ ...LINE, medicine: "  " }))).toEqual([
      { message: VALIDATION_MESSAGES.required(words.medicineLabel), path: "medicine" },
    ]);
    expect(
      issues(
        prescriptionItemSchema.safeParse({
          ...LINE,
          medicine: "x".repeat(TEXT_LIMITS.medicine + 1),
          strength: "x".repeat(TEXT_LIMITS.strength + 1),
          dose: "x".repeat(TEXT_LIMITS.dose + 1),
          frequency: "x".repeat(TEXT_LIMITS.frequency + 1),
          durationDays: "400",
          instructions: "x".repeat(TEXT_LIMITS.instructions + 1),
        }),
      ),
    ).toEqual([
      { message: VALIDATION_MESSAGES.tooLong(words.medicineLabel, TEXT_LIMITS.medicine), path: "medicine" },
      { message: VALIDATION_MESSAGES.tooLong(words.strengthLabel, TEXT_LIMITS.strength), path: "strength" },
      { message: VALIDATION_MESSAGES.tooLong(words.doseLabel, TEXT_LIMITS.dose), path: "dose" },
      { message: VALIDATION_MESSAGES.tooLong(words.frequencyLabel, TEXT_LIMITS.frequency), path: "frequency" },
      { message: VALIDATION_MESSAGES.between(words.daysLabel, 1, 365), path: "durationDays" },
      {
        message: VALIDATION_MESSAGES.tooLong(words.instructionsLabel, TEXT_LIMITS.instructions),
        path: "instructions",
      },
    ]);
  });

  it("takes a timing only from PRESCRIPTION_TIMINGS", () => {
    expect(issues(prescriptionItemSchema.safeParse({ ...LINE, timing: "AT_NOON" }))).toEqual([
      { message: VALIDATION_MESSAGES.invalid, path: "timing" },
    ]);
  });
});

describe("prescriptionSchema (D210, D216)", () => {
  it("keeps the medicines in order, the advice on its lines, and the diagnosis tick", () => {
    expect(
      prescriptionSchema.parse({
        items: [LINE, { ...LINE, medicine: "Cetirizine" }],
        advice: " Plenty of fluids\r\nRest ",
        printDiagnosis: true,
      }),
    ).toEqual({
      items: [READ, { ...READ, medicine: "Cetirizine" }],
      advice: "Plenty of fluids\nRest",
      printDiagnosis: true,
    });
    expect(prescriptionSchema.parse({ items: [], advice: "", printDiagnosis: false })).toEqual({
      items: [],
      advice: null,
      printDiagnosis: false,
    });
  });

  it("holds at most PRESCRIPTION_MAX_ITEMS medicines, and its advice to its column", () => {
    expect(
      issues(
        prescriptionSchema.safeParse({
          items: Array.from({ length: PRESCRIPTION_MAX_ITEMS + 1 }, () => LINE),
          advice: "x".repeat(TEXT_LIMITS.advice + 1),
          printDiagnosis: false,
        }),
      ),
    ).toEqual([
      { message: VALIDATION_MESSAGES.atMostMedicines(PRESCRIPTION_MAX_ITEMS), path: "items" },
      { message: VALIDATION_MESSAGES.tooLong(words.adviceLabel, TEXT_LIMITS.advice), path: "advice" },
    ]);
    expect(issues(prescriptionSchema.safeParse({ items: "none", advice: "", printDiagnosis: "yes" }))).toEqual([
      { message: VALIDATION_MESSAGES.invalid, path: "items" },
      { message: VALIDATION_MESSAGES.invalid, path: "printDiagnosis" },
    ]);
  });
});

describe("savePrescriptionSchema (D206)", () => {
  const typed = { items: [LINE], advice: "", printDiagnosis: false };
  const seen = { items: [{ ...READ, timing: "BEDTIME", durationDays: 5 }], advice: "Rest", printDiagnosis: true };

  it("carries what was typed, and the prescription as read — or none", () => {
    expect(savePrescriptionSchema.parse({ prescription: typed, seen })).toEqual({
      prescription: { items: [READ], advice: null, printDiagnosis: false },
      seen,
    });
    expect(savePrescriptionSchema.parse({ prescription: typed, seen: null }).seen).toBeNull();
  });

  it("refuses a copy it cannot read, and none sent at all", () => {
    expect(savePrescriptionSchema.safeParse({ prescription: typed }).success).toBe(false);
    expect(
      savePrescriptionSchema.safeParse({
        prescription: typed,
        seen: { ...seen, items: [{ ...READ, durationDays: 1.5 }] },
      }).success,
    ).toBe(false);
    expect(
      savePrescriptionSchema.safeParse({ prescription: typed, seen: { ...seen, items: [{ ...READ, timing: "NOON" }] } })
        .success,
    ).toBe(false);
    expect(savePrescriptionSchema.safeParse("nothing")).toMatchObject({
      error: { issues: [{ message: VALIDATION_MESSAGES.invalid }] },
    });
  });
});

describe("medicineSearchSchema (D211)", () => {
  it("takes what is typed of a name, tidied, and the doctor", () => {
    expect(medicineSearchSchema.parse({ q: "  para  cet ", doctorId: D })).toEqual({ q: "para cet", doctorId: D });
  });

  it("refuses nothing typed, too much typed, and a doctor it cannot read", () => {
    expect(issues(medicineSearchSchema.safeParse({ q: " ", doctorId: D }))).toEqual([
      { message: VALIDATION_MESSAGES.required(words.medicineLabel), path: "q" },
    ]);
    expect(issues(medicineSearchSchema.safeParse({ q: "x".repeat(TEXT_LIMITS.medicine + 1), doctorId: D }))).toEqual([
      { message: VALIDATION_MESSAGES.tooLong(words.medicineLabel, TEXT_LIMITS.medicine), path: "q" },
    ]);
    expect(issues(medicineSearchSchema.safeParse({ q: "para", doctorId: "nope" }))).toEqual([
      { message: VALIDATION_MESSAGES.invalid, path: "doctorId" },
    ]);
  });
});
