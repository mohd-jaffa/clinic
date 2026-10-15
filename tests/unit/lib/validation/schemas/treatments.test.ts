import { describe, expect, it } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  cancelTreatmentSchema,
  changeTreatmentSchema,
  newTreatmentFormSchema,
  newTreatmentSchema,
  nextDueFormSchema,
  sessionFormSchema,
  treatmentSessionSchema,
  treatmentStatusSchema,
  TREATMENT_PARTS,
} from "@/lib/validation";

const PATIENT = "11111111-1111-4111-8111-111111111111";
const VISIT = "22222222-2222-4222-8222-222222222222";
const DOCTOR = "33333333-3333-4333-8333-333333333333";
const typed = {
  patientId: PATIENT,
  visitId: VISIT,
  doctorId: "",
  start: "IN_PROGRESS",
  name: "  Root   canal ",
  description: "",
  estimatedCost: "4,500",
  note: "Access opened",
  nextDueOn: "",
};
const messages = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.map(({ path, message }) => [path.join("."), message]);

describe("newTreatmentSchema (D252, D258)", () => {
  it("reads one begun in a visit: the visit's doctor's, its note the first session's, the estimate in paise", () => {
    expect(newTreatmentSchema.parse(typed)).toEqual({
      patientId: PATIENT,
      visitId: VISIT,
      doctorId: null,
      start: "IN_PROGRESS",
      name: "Root canal",
      description: null,
      estimatedCost: 450000,
      note: "Access opened",
      nextDueOn: null,
    });
  });

  it("keeps a note only for one begun in a visit; from the profile, for the doctor chosen", () => {
    expect(newTreatmentSchema.parse({ ...typed, start: "PLANNED" }).note).toBeNull();
    const profile = newTreatmentSchema.parse({ ...typed, visitId: null, doctorId: DOCTOR, nextDueOn: "2026-10-22" });
    expect(profile).toMatchObject({ doctorId: DOCTOR, note: null, nextDueOn: "2026-10-22" });
    expect(messages(newTreatmentSchema.safeParse({ ...typed, visitId: null }))).toEqual([
      ["doctorId", "Choose doctor."],
    ]);
  });

  it("refuses a name too long or missing, a start it does not know, a day it cannot read", () => {
    const result = newTreatmentSchema.safeParse({
      ...typed,
      name: "x".repeat(TEXT_LIMITS.treatmentName + 1),
      start: "ON_HOLD",
      nextDueOn: "soon",
    });
    expect(messages(result)?.map(([path]) => path)).toEqual(["name", "start", "nextDueOn"]);
    expect(newTreatmentSchema.safeParse({ ...typed, name: " " }).success).toBe(false);
  });

  it("in its sheet, wants the next sitting today or later", () => {
    expect(messages(newTreatmentFormSchema("2026-10-15").safeParse({ ...typed, nextDueOn: "2026-10-14" }))).toEqual([
      ["nextDueOn", "Next due can’t be before today."],
    ]);
    expect(newTreatmentFormSchema("2026-10-15").safeParse({ ...typed, nextDueOn: "2026-10-15" }).success).toBe(true);
  });
});

describe("nextDueFormSchema (D259)", () => {
  it("is a day today or later, or none", () => {
    const schema = nextDueFormSchema("2026-10-15");
    expect(schema.parse({ nextDueOn: "" })).toEqual({ nextDueOn: null });
    expect(schema.parse({ nextDueOn: "2026-10-22" })).toEqual({ nextDueOn: "2026-10-22" });
    expect(schema.safeParse({ nextDueOn: "2026-10-01" }).success).toBe(false);
  });
});

describe("changeTreatmentSchema (D251, D252)", () => {
  it("reads its details or its next sitting, each with the copy read", () => {
    expect(TREATMENT_PARTS).toEqual(["DETAILS", "NEXT_DUE"]);
    expect(
      changeTreatmentSchema.parse({
        part: "DETAILS",
        changes: { name: "Crown", description: "", estimatedCost: "", doctorId: DOCTOR },
        seen: { name: "Cap", description: null, estimatedCostPaise: 800000, doctorId: DOCTOR },
      }),
    ).toEqual({
      part: "DETAILS",
      changes: { name: "Crown", description: null, estimatedCost: null, doctorId: DOCTOR },
      seen: { name: "Cap", description: null, estimatedCostPaise: 800000, doctorId: DOCTOR },
    });
    expect(changeTreatmentSchema.safeParse({ part: "STATUS", changes: {}, seen: {} }).success).toBe(false);
  });
});

describe("treatmentStatusSchema (D250, D251)", () => {
  it("takes a reason only with a cancellation", () => {
    expect(treatmentStatusSchema.parse({ status: "CANCELLED", seen: "PLANNED", reason: " Declined " })).toEqual({
      status: "CANCELLED",
      seen: "PLANNED",
      reason: "Declined",
    });
    expect(treatmentStatusSchema.parse({ status: "ON_HOLD", seen: "PLANNED" }).reason).toBeNull();
    expect(messages(treatmentStatusSchema.safeParse({ status: "ON_HOLD", seen: "PLANNED", reason: "Away" }))).toEqual([
      ["reason", VALIDATION_MESSAGES.invalid],
    ]);
    expect(cancelTreatmentSchema.parse({ reason: "" })).toEqual({ reason: null });
  });
});

describe("treatmentSessionSchema (D256, D257)", () => {
  it("reads the note, whether it completes it, and the note as read — or none before the first", () => {
    expect(treatmentSessionSchema.parse({ note: " ", complete: true, seen: null })).toEqual({
      note: null,
      complete: true,
      seen: null,
    });
    expect(
      sessionFormSchema.safeParse({ note: "x".repeat(TEXT_LIMITS.sessionNote + 1), complete: false }).success,
    ).toBe(false);
  });
});
