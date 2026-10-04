import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  alertSchema,
  firstIssue,
  patientListSchema,
  patientMatchesSchema,
  patientSchema,
  updateAlertSchema,
  updatePatientSchema,
  type PatientInput,
} from "@/lib/validation";

function messageOf(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : firstIssue(result.error);
}

const DOCTOR = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const patient = (overrides: Partial<PatientInput> = {}): PatientInput => ({
  fullName: " Rohan  Mehta ",
  phone: "98765 43210",
  born: { as: "DATE", date: "1990-04-12", years: "" },
  gender: "MALE",
  assignedDoctorId: "",
  altPhone: "",
  email: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
  ...overrides,
});

// Today, in Kochi: 3 October 2026.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("patientSchema (plan §10.1, D33)", () => {
  it("reads what the sheet holds as the patient to store", () => {
    expect(patientSchema.parse(patient())).toEqual({
      fullName: "Rohan Mehta",
      phone: "+919876543210",
      born: { dateOfBirth: "1990-04-12", dobIsEstimated: false },
      gender: "MALE",
      assignedDoctorId: null,
      altPhone: null,
      email: null,
      address: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      notes: null,
    });
  });

  it("keeps the details given, and a doctor chosen", () => {
    expect(
      patientSchema.parse(
        patient({
          assignedDoctorId: DOCTOR,
          altPhone: "0484 234 5678",
          email: "rohan@example.com",
          address: "12 MG Road\nKochi",
          emergencyContactName: "Anita Mehta",
          emergencyContactPhone: "+91 98765 00000",
          notes: "Prefers mornings",
        }),
      ),
    ).toMatchObject({
      assignedDoctorId: DOCTOR,
      altPhone: "0484 234 5678",
      email: "rohan@example.com",
      address: "12 MG Road\nKochi",
      emergencyContactName: "Anita Mehta",
      emergencyContactPhone: "+91 98765 00000",
      notes: "Prefers mornings",
    });
    const { assignedDoctorId, ...left } = patient();
    expect(assignedDoctorId).toBe("");
    expect(patientSchema.parse(left).assignedDoctorId).toBeNull();
  });

  it("keeps an age as today that many years ago, marked estimated (D100)", () => {
    expect(patientSchema.parse(patient({ born: { as: "AGE", date: "", years: "34" } })).born).toEqual({
      dateOfBirth: "1992-10-03",
      dobIsEstimated: true,
    });
    expect(patientSchema.parse(patient({ born: { as: "AGE", years: "0" } })).born.dateOfBirth).toBe("2026-10-03");
  });

  it("asks for what every patient needs, in the field's own words", () => {
    expect(messageOf(patientSchema, patient({ fullName: "  " }))).toBe(VALIDATION_MESSAGES.required("Full name"));
    expect(messageOf(patientSchema, patient({ phone: "" }))).toBe(VALIDATION_MESSAGES.required("Mobile"));
    expect(messageOf(patientSchema, patient({ phone: "12345" }))).toBe(VALIDATION_MESSAGES.phone);
    expect(messageOf(patientSchema, patient({ gender: "" }))).toBe(VALIDATION_MESSAGES.choose("Gender"));
    expect(messageOf(patientSchema, patient({ born: { as: "DATE", date: "" } }))).toBe(
      VALIDATION_MESSAGES.required("Date of birth"),
    );
    expect(messageOf(patientSchema, patient({ born: { as: "DATE" } }))).toBe(
      VALIDATION_MESSAGES.required("Date of birth"),
    );
    expect(messageOf(patientSchema, patient({ born: { as: "AGE" } }))).toBe(
      VALIDATION_MESSAGES.required("Age in years"),
    );
  });

  it("takes a date of birth from today back 120 years, and an age up to 120", () => {
    for (const date of ["2026-10-04", "1906-10-02"]) {
      expect(messageOf(patientSchema, patient({ born: { as: "DATE", date } })), date).toBe(
        VALIDATION_MESSAGES.birthDate,
      );
    }
    expect(patientSchema.safeParse(patient({ born: { as: "DATE", date: "1906-10-03" } })).success).toBe(true);
    expect(patientSchema.safeParse(patient({ born: { as: "DATE", date: "2026-10-03" } })).success).toBe(true);
    expect(messageOf(patientSchema, patient({ born: { as: "AGE", years: "121" } }))).toBe(
      VALIDATION_MESSAGES.between("Age in years", 0, 120),
    );
    expect(messageOf(patientSchema, patient({ born: { as: "AGE", years: "3.5" } }))).toBe(
      VALIDATION_MESSAGES.wholeNumber("Age in years"),
    );
    expect(messageOf(patientSchema, patient({ born: { as: "DATE", date: "2026-02-30" } }))).toBe(
      VALIDATION_MESSAGES.day("Date of birth"),
    );
  });

  it("puts a refusal of the birth beside the field in use", () => {
    const date = patientSchema.safeParse(patient({ born: { as: "DATE", date: "2030-01-01" } }));
    expect(date.error?.issues[0].path).toEqual(["born", "date"]);
    const age = patientSchema.safeParse(patient({ born: { as: "AGE", years: "" } }));
    expect(age.error?.issues[0].path).toEqual(["born", "years"]);
    expect(messageOf(patientSchema, patient({ born: { as: "LATER" as "AGE" } }))).toBe(VALIDATION_MESSAGES.invalid);
  });

  it("bounds every field as the database does (0015)", () => {
    expect(messageOf(patientSchema, patient({ fullName: "a".repeat(TEXT_LIMITS.personName + 1) }))).toBe(
      VALIDATION_MESSAGES.tooLong("Full name", TEXT_LIMITS.personName),
    );
    expect(messageOf(patientSchema, patient({ notes: "a".repeat(TEXT_LIMITS.notes + 1) }))).toBe(
      VALIDATION_MESSAGES.tooLong("Notes", TEXT_LIMITS.notes),
    );
    expect(messageOf(patientSchema, patient({ email: "rohan" }))).toBe(VALIDATION_MESSAGES.email("Email"));
    expect(messageOf(patientSchema, patient({ altPhone: "call me" }))).toBe(
      VALIDATION_MESSAGES.phoneNumber("Alternate phone"),
    );
    expect(messageOf(patientSchema, patient({ assignedDoctorId: "dr-1" }))).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("updatePatientSchema", () => {
  it("changes only the fields sent; one sent empty is cleared", () => {
    expect(updatePatientSchema.parse({ fullName: "Rohan M" })).toEqual({ fullName: "Rohan M" });
    expect(updatePatientSchema.parse({ email: "", assignedDoctorId: "" })).toEqual({
      email: null,
      assignedDoctorId: null,
    });
    expect(updatePatientSchema.parse({ born: { as: "AGE", years: "40" } })).toEqual({
      born: { dateOfBirth: "1986-10-03", dobIsEstimated: true },
    });
    expect(updatePatientSchema.parse({})).toEqual({});
  });

  it("holds a field sent to the same rules", () => {
    expect(messageOf(updatePatientSchema, { fullName: "" })).toBe(VALIDATION_MESSAGES.required("Full name"));
    expect(messageOf(updatePatientSchema, { gender: "" })).toBe(VALIDATION_MESSAGES.choose("Gender"));
  });
});

describe("patientMatchesSchema (D98, D106)", () => {
  it("reads the mobile as it is stored", () => {
    expect(patientMatchesSchema.parse({ phone: "098765 43210" })).toEqual({ phone: "+919876543210" });
    expect(messageOf(patientMatchesSchema, { phone: "98765" })).toBe(VALIDATION_MESSAGES.phone);
  });
});

describe("patientListSchema (plan §10.2, D98)", () => {
  it("reads a page of the list: what was searched, normalised, the tab, and where it starts", () => {
    expect(patientListSchema.parse({ search: "  Rohan   Mehta ", tab: "ARCHIVED", cursor: "20" })).toEqual({
      search: "Rohan Mehta",
      tab: "ARCHIVED",
      cursor: 20,
    });
  });

  it("starts at everyone's first page, with nothing searched", () => {
    expect(patientListSchema.parse({})).toEqual({ search: null, tab: "ALL" });
  });

  it("refuses a tab it does not know", () => {
    expect(messageOf(patientListSchema, { tab: "OWING" })).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("alertSchema (plan §10.4)", () => {
  it("reads a kind, a tidied name and a note, blank as none", () => {
    expect(alertSchema.parse({ kind: "ALLERGY", label: "  Penicillin ", note: "  " })).toEqual({
      kind: "ALLERGY",
      label: "Penicillin",
      note: null,
    });
    expect(alertSchema.parse({ kind: "MEDICATION", label: "Metformin 500 mg", note: "Twice a day" })).toMatchObject({
      note: "Twice a day",
    });
  });

  it("asks for a kind and a name, each bounded", () => {
    expect(messageOf(alertSchema, { kind: "HABIT", label: "Smoking" })).toBe(VALIDATION_MESSAGES.choose("Kind"));
    expect(messageOf(alertSchema, { kind: "ALLERGY", label: "" })).toBe(VALIDATION_MESSAGES.required("Name"));
    expect(messageOf(alertSchema, { kind: "ALLERGY", label: "x".repeat(TEXT_LIMITS.alertLabel + 1) })).toBe(
      VALIDATION_MESSAGES.tooLong("Name", TEXT_LIMITS.alertLabel),
    );
    expect(
      messageOf(alertSchema, { kind: "ALLERGY", label: "Dust", note: "x".repeat(TEXT_LIMITS.alertNote + 1) }),
    ).toBe(VALIDATION_MESSAGES.tooLong("Note", TEXT_LIMITS.alertNote));
  });
});

describe("updateAlertSchema (D118, D119)", () => {
  it("takes a name, a note, or turning off — never a kind, never turning on", () => {
    expect(updateAlertSchema.parse({ label: "Amoxicillin", note: "" })).toEqual({ label: "Amoxicillin", note: null });
    expect(updateAlertSchema.parse({ active: false })).toEqual({ active: false });
    expect(updateAlertSchema.parse({ kind: "CONDITION" })).toEqual({});
    expect(messageOf(updateAlertSchema, { active: true })).toBe(VALIDATION_MESSAGES.invalid);
  });
});
