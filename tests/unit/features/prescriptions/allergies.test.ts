import { describe, expect, it } from "vitest";

import { allergiesIn } from "@/features/prescriptions/allergies";
import type { PatientAlert } from "@/features/patients/types";

const alert = (overrides: Partial<PatientAlert>): PatientAlert => ({
  id: "al-1",
  kind: "ALLERGY",
  label: "Penicillin",
  note: null,
  active: true,
  ...overrides,
});

const ALERTS = [
  alert({}),
  alert({ id: "al-2", label: " Sulfa " }),
  alert({ id: "al-3", label: "Aspirin", active: false }),
  alert({ id: "al-4", kind: "MEDICATION", label: "Metformin" }),
];

describe("allergiesIn (D212)", () => {
  it("finds each active allergy a medicine's name contains, whatever the case", () => {
    expect(allergiesIn("  PENICILLIN V ", ALERTS)).toEqual(["Penicillin"]);
    expect(allergiesIn("Sulfamethoxazole + penicillin", ALERTS)).toEqual(["Penicillin", " Sulfa "]);
  });

  it("is a match of words: no allergy turned off, no condition or medication, nothing for nothing typed", () => {
    expect(allergiesIn("Amoxicillin", ALERTS)).toEqual([]);
    expect(allergiesIn("Aspirin 75 mg", ALERTS)).toEqual([]);
    expect(allergiesIn("Metformin", ALERTS)).toEqual([]);
    expect(allergiesIn("   ", ALERTS)).toEqual([]);
  });
});
