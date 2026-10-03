import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import { clinicDetailsSchema, firstIssue, updateClinicSchema } from "@/lib/validation";

function messageOf(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : firstIssue(result.error);
}

const details = {
  name: "  Smile   Care Dental ",
  clinicType: "DENTAL",
  address: " 12 MG Road\n  Kochi ",
  city: " Kochi ",
  phone: " 0484 234 5678 ",
  email: " desk@smilecare.in ",
  gstin: "32abcde1234f1z5",
};

describe("clinicDetailsSchema (plan §9, D78)", () => {
  it("tidies every detail, as the clinics CHECKs want them", () => {
    expect(clinicDetailsSchema.parse(details)).toEqual({
      name: "Smile Care Dental",
      clinicType: "DENTAL",
      address: "12 MG Road\n  Kochi",
      city: "Kochi",
      phone: "0484 234 5678",
      email: "desk@smilecare.in",
      gstin: "32ABCDE1234F1Z5",
    });
  });

  it("keeps the phone, the email and the GSTIN optional: blank is none", () => {
    expect(clinicDetailsSchema.parse({ ...details, phone: "", email: "", gstin: "" })).toMatchObject({
      phone: null,
      email: null,
      gstin: null,
    });
  });

  it("names the field that is wrong", () => {
    expect(messageOf(clinicDetailsSchema, { ...details, name: " " })).toBe(VALIDATION_MESSAGES.required("Clinic name"));
    expect(messageOf(clinicDetailsSchema, { ...details, clinicType: "DENTIST" })).toBe(
      VALIDATION_MESSAGES.choose("Clinic type"),
    );
    expect(messageOf(clinicDetailsSchema, { ...details, city: "a".repeat(TEXT_LIMITS.city + 1) })).toBe(
      VALIDATION_MESSAGES.tooLong("City", TEXT_LIMITS.city),
    );
    expect(messageOf(clinicDetailsSchema, { ...details, email: "desk" })).toBe(
      VALIDATION_MESSAGES.email("Clinic email"),
    );
    expect(messageOf(clinicDetailsSchema, { ...details, gstin: "32" })).toBe(VALIDATION_MESSAGES.gstin);
  });
});

describe("updateClinicSchema", () => {
  it("takes the details, the paper size or the fee timing, each on its own", () => {
    expect(updateClinicSchema.parse({ paperSize: "A5" })).toEqual({ paperSize: "A5" });
    expect(updateClinicSchema.parse({ feeTiming: "AT_ARRIVAL" })).toEqual({ feeTiming: "AT_ARRIVAL" });
    expect(updateClinicSchema.parse({ details })).toMatchObject({ details: { name: "Smile Care Dental" } });
    expect(updateClinicSchema.parse({})).toEqual({});
  });

  it("refuses a paper size or a fee timing it does not know", () => {
    expect(messageOf(updateClinicSchema, { paperSize: "A3" })).toBe(VALIDATION_MESSAGES.choose("Paper size"));
    expect(messageOf(updateClinicSchema, { feeTiming: "LATER" })).toBe(VALIDATION_MESSAGES.choose("Consultation fee"));
  });
});
