import { describe, expect, it } from "vitest";

import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import {
  followUpFormSchema,
  followUpSchema,
  saveVitalsSchema,
  startVisitSchema,
  visitChangeSchema,
  visitNotesSchema,
  vitalsSchema,
  type VitalsInput,
} from "@/lib/validation";

const P = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const D = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const { vitals: labels, visit: words, appointment } = UI_TEXT;

const issues = (result: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  result.error?.issues.map(({ message, path }) => ({ message, path: path.join(".") }));
const issue = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

const NONE: VitalsInput = {
  systolic: "",
  diastolic: "",
  pulse: "",
  temperatureF: "",
  spo2: "",
  respiratoryRate: "",
  weightKg: "",
  heightCm: "",
};
const typed = (readings: Partial<VitalsInput>) => vitalsSchema.safeParse({ ...NONE, ...readings });

describe("vitalsSchema (plan §12.2, D202)", () => {
  it("reads each reading as a number, trimmed, and a blank one as none", () => {
    expect(
      vitalsSchema.parse({
        systolic: " 120 ",
        diastolic: "80",
        pulse: "72",
        temperatureF: "98.6",
        spo2: "98",
        respiratoryRate: "16",
        weightKg: "64.55",
        heightCm: "162.5",
      }),
    ).toEqual({
      systolic: 120,
      diastolic: 80,
      pulse: 72,
      temperatureF: 98.6,
      spo2: 98,
      respiratoryRate: 16,
      weightKg: 64.55,
      heightCm: 162.5,
    });
    expect(vitalsSchema.parse(NONE)).toEqual({
      systolic: null,
      diastolic: null,
      pulse: null,
      temperatureF: null,
      spo2: null,
      respiratoryRate: null,
      weightKg: null,
      heightCm: null,
    });
  });

  it("refuses what is not a number — a whole one where the reading is whole", () => {
    expect(issue(typed({ pulse: "seventy" }))).toBe(VALIDATION_MESSAGES.wholeNumber(labels.pulse));
    expect(issue(typed({ temperatureF: "98,6" }))).toBe(VALIDATION_MESSAGES.number(labels.temperatureF));
    expect(issue(typed({ pulse: "1000" }))).toBe(VALIDATION_MESSAGES.wholeNumber(labels.pulse));
    expect(issue(vitalsSchema.safeParse({ ...NONE, pulse: 72 }))).toBe(VALIDATION_MESSAGES.invalid);
  });

  it("refuses more decimals than the reading is taken to", () => {
    expect(issue(typed({ spo2: "98.5" }))).toBe(VALIDATION_MESSAGES.wholeNumber(labels.spo2));
    expect(issue(typed({ temperatureF: "98.65" }))).toBe(VALIDATION_MESSAGES.decimals(labels.temperatureF, 1));
    expect(issue(typed({ weightKg: "64.555" }))).toBe(VALIDATION_MESSAGES.decimals(labels.weightKg, 2));
    expect(VALIDATION_MESSAGES.decimals(labels.temperatureF, 1)).toBe("Temperature can have at most 1 decimal place.");
    expect(VALIDATION_MESSAGES.decimals(labels.weightKg, 2)).toBe("Weight can have at most 2 decimal places.");
  });

  it("holds each reading within its limits", () => {
    expect(issue(typed({ spo2: "101" }))).toBe(VALIDATION_MESSAGES.between(labels.spo2, 50, 100));
    expect(issue(typed({ temperatureF: "89.9" }))).toBe(VALIDATION_MESSAGES.between(labels.temperatureF, 90, 110));
    expect(issue(typed({ weightKg: "0.4" }))).toBe(VALIDATION_MESSAGES.between(labels.weightKg, 0.5, 350));
  });

  it("takes blood pressure as both readings or neither, the upper one higher", () => {
    expect(typed({ systolic: "120", diastolic: "80" }).success).toBe(true);
    expect(issues(typed({ systolic: "120" }))).toEqual([
      { message: VALIDATION_MESSAGES.bloodPressure, path: "diastolic" },
    ]);
    expect(issues(typed({ diastolic: "80" }))).toEqual([
      { message: VALIDATION_MESSAGES.bloodPressure, path: "systolic" },
    ]);
    expect(issues(typed({ systolic: "80", diastolic: "80" }))).toEqual([
      { message: VALIDATION_MESSAGES.bloodPressure, path: "diastolic" },
    ]);
  });

  it("is saved with the readings as the screen last read them — or none, before any were taken (D206)", () => {
    const seen = {
      systolic: 120,
      diastolic: 80,
      pulse: null,
      temperatureF: null,
      spo2: null,
      respiratoryRate: null,
      weightKg: null,
      heightCm: null,
    };
    expect(saveVitalsSchema.parse({ vitals: NONE, seen }).seen).toEqual(seen);
    expect(saveVitalsSchema.parse({ vitals: NONE, seen: null }).seen).toBeNull();
    expect(issue(saveVitalsSchema.safeParse({ vitals: NONE, seen: { ...seen, pulse: "72" } }))).toBe(
      VALIDATION_MESSAGES.invalid,
    );
  });
});

describe("visitNotesSchema (plan §12.2)", () => {
  it("tidies each field, a blank one as none, and bounds it", () => {
    expect(visitNotesSchema.parse({ complaint: "  Fever ", diagnosis: "", notes: "Rest​\n Fluids" })).toEqual({
      complaint: "Fever",
      diagnosis: null,
      notes: "Rest\n Fluids",
    });
    expect(issue(visitNotesSchema.safeParse({ complaint: "x".repeat(1001), diagnosis: "", notes: "" }))).toBe(
      VALIDATION_MESSAGES.tooLong(words.complaintLabel, 1000),
    );
  });
});

describe("followUpSchema (D205)", () => {
  it("reads a day, or none", () => {
    expect(followUpSchema.parse({ followUpOn: " 2026-10-20 " })).toEqual({ followUpOn: "2026-10-20" });
    expect(followUpSchema.parse({ followUpOn: "" })).toEqual({ followUpOn: null });
    expect(issue(followUpSchema.safeParse({ followUpOn: "2026-02-30" }))).toBe(
      VALIDATION_MESSAGES.day(words.followUpLabel),
    );
    expect(issue(followUpSchema.safeParse({ followUpOn: null }))).toBe(VALIDATION_MESSAGES.invalid);
  });

  it("as its section checks it, falls after the visit's day", () => {
    const schema = followUpFormSchema("2026-10-13");
    expect(schema.parse({ followUpOn: "2026-10-14" })).toEqual({ followUpOn: "2026-10-14" });
    expect(schema.parse({ followUpOn: "" })).toEqual({ followUpOn: null });
    for (const day of ["2026-10-13", "2026-10-12"]) {
      expect(issues(schema.safeParse({ followUpOn: day }))).toEqual([
        { message: VALIDATION_MESSAGES.afterVisit(words.followUpLabel), path: "followUpOn" },
      ]);
    }
    expect(VALIDATION_MESSAGES.afterVisit(words.followUpLabel)).toBe("Review on must be after the visit.");
  });
});

describe("visitChangeSchema (D202, D206)", () => {
  it("saves the notes, or the follow-up, each with the section as last read", () => {
    expect(
      visitChangeSchema.parse({
        section: "NOTES",
        changes: { complaint: "Fever", diagnosis: "", notes: "" },
        seen: { complaint: null, diagnosis: null, notes: null },
      }),
    ).toEqual({
      section: "NOTES",
      changes: { complaint: "Fever", diagnosis: null, notes: null },
      seen: { complaint: null, diagnosis: null, notes: null },
    });
    expect(
      visitChangeSchema.parse({
        section: "FOLLOW_UP",
        changes: { followUpOn: "" },
        seen: { followUpOn: "2026-10-20" },
      }),
    ).toEqual({ section: "FOLLOW_UP", changes: { followUpOn: null }, seen: { followUpOn: "2026-10-20" } });
  });

  it("refuses a section it does not know, and one without what was read", () => {
    expect(issue(visitChangeSchema.safeParse({ section: "VITALS", changes: {}, seen: {} }))).toBe(
      VALIDATION_MESSAGES.invalid,
    );
    expect(visitChangeSchema.safeParse({ section: "FOLLOW_UP", changes: { followUpOn: "" } }).success).toBe(false);
  });
});

describe("startVisitSchema (D204)", () => {
  it("names the patient and the doctor chosen", () => {
    expect(startVisitSchema.parse({ patientId: P, doctorId: D })).toEqual({ patientId: P, doctorId: D });
  });

  it("asks for a doctor while none is chosen, and refuses what is not one", () => {
    expect(issue(startVisitSchema.safeParse({ patientId: P, doctorId: "" }))).toBe(
      VALIDATION_MESSAGES.choose(appointment.doctorLabel),
    );
    expect(issue(startVisitSchema.safeParse({ patientId: P, doctorId: "d-1" }))).toBe(VALIDATION_MESSAGES.invalid);
    expect(issue(startVisitSchema.safeParse({ patientId: "p-1", doctorId: D }))).toBe(VALIDATION_MESSAGES.invalid);
  });
});
