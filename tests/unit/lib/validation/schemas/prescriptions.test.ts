import { describe, expect, it } from "vitest";

import { PRESCRIPTION_MAX_ITEMS, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import {
  changeTemplateSchema,
  medicineSearchSchema,
  prescriptionItemSchema,
  prescriptionSchema,
  savePrescriptionSchema,
  saveTemplateSchema,
  templateNameSchema,
  templateSchema,
  templatesQuerySchema,
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

describe("templateSchema (D242)", () => {
  it("keeps its name, medicines and advice, tidied", () => {
    expect(templateSchema.parse({ name: "  Viral   fever ", items: [LINE], advice: " Rest " })).toEqual({
      name: "Viral fever",
      items: [READ],
      advice: "Rest",
    });
    expect(templateSchema.parse({ name: "Post-extraction", items: [], advice: "Cold food" })).toMatchObject({
      items: [],
    });
  });

  it("refuses no name, too long a name, nothing in it, and too many medicines", () => {
    expect(issues(templateSchema.safeParse({ name: " ", items: [LINE], advice: "" }))).toEqual([
      { message: VALIDATION_MESSAGES.required(words.templateNameLabel), path: "name" },
    ]);
    expect(
      issues(templateSchema.safeParse({ name: "x".repeat(TEXT_LIMITS.templateName + 1), items: [LINE], advice: "" })),
    ).toEqual([
      { message: VALIDATION_MESSAGES.tooLong(words.templateNameLabel, TEXT_LIMITS.templateName), path: "name" },
    ]);
    expect(issues(templateSchema.safeParse({ name: "Empty", items: [], advice: "  " }))).toEqual([
      { message: VALIDATION_MESSAGES.templateEmpty, path: "items" },
    ]);
    expect(
      issues(
        templateSchema.safeParse({
          name: "Many",
          items: Array.from({ length: PRESCRIPTION_MAX_ITEMS + 1 }, () => LINE),
          advice: "",
        }),
      ),
    ).toEqual([{ message: VALIDATION_MESSAGES.atMostTemplateMedicines(PRESCRIPTION_MAX_ITEMS), path: "items" }]);
    expect(templateSchema.safeParse({ name: "Odd", items: "none", advice: "" })).toMatchObject({
      error: { issues: [{ message: VALIDATION_MESSAGES.invalid }] },
    });
  });
});

describe("saving and changing a template (D242, D243)", () => {
  const template = { name: "Viral fever", items: [LINE], advice: "" };

  it("takes the name alone from a visit", () => {
    expect(templateNameSchema.parse({ name: " Cough " })).toEqual({ name: "Cough" });
  });

  it("makes a new one, replacing another only when asked", () => {
    expect(saveTemplateSchema.parse({ template })).toMatchObject({ replace: false });
    expect(saveTemplateSchema.parse({ template, replace: true })).toMatchObject({ replace: true });
    expect(saveTemplateSchema.safeParse("nothing")).toMatchObject({
      error: { issues: [{ message: VALIDATION_MESSAGES.invalid }] },
    });
    expect(issues(saveTemplateSchema.safeParse({ template, replace: "yes" }))).toEqual([
      { message: VALIDATION_MESSAGES.invalid, path: "replace" },
    ]);
  });

  it("changes its contents, or archives or restores it — never both, nor anything else", () => {
    expect(changeTemplateSchema.parse({ template })).toEqual({
      template: { ...template, items: [READ], advice: null },
    });
    expect(changeTemplateSchema.parse({ active: false })).toEqual({ active: false });
    for (const change of [{ template, active: true }, { active: "no" }, {}]) {
      expect(changeTemplateSchema.safeParse(change)).toMatchObject({
        error: { issues: [{ message: VALIDATION_MESSAGES.invalid }] },
      });
    }
  });

  it("reads whose templates by a doctor it can read", () => {
    expect(templatesQuerySchema.parse({ doctorId: D })).toEqual({ doctorId: D });
    expect(issues(templatesQuerySchema.safeParse({ doctorId: "nope" }))).toEqual([
      { message: VALIDATION_MESSAGES.invalid, path: "doctorId" },
    ]);
  });
});
