import { describe, expect, it } from "vitest";

import {
  fromEmbedded,
  fromPrevious,
  howTaken,
  medicineTitle,
  templateLine,
  toContent,
  toItem,
  toItemRow,
  toRow,
  withAdvice,
} from "@/features/prescriptions/content";
import type { PrescriptionItem, PrescriptionItemRow } from "@/features/prescriptions/types";

const ITEM: PrescriptionItem = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: 5,
  instructions: "After meals",
};
const ROW: PrescriptionItemRow = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  duration_days: 5,
  instructions: "After meals",
};
const BARE: PrescriptionItem = {
  medicine: "Cetirizine",
  strength: null,
  dose: null,
  frequency: null,
  timing: null,
  durationDays: null,
  instructions: null,
};

describe("a prescription between the screen and the database (D206, D210)", () => {
  it("names a medicine line each way, in a fixed order", () => {
    expect(toItem(ROW)).toEqual(ITEM);
    expect(toItemRow(ITEM)).toEqual(ROW);
    expect(Object.keys(toItem(ROW))).toEqual([
      "medicine",
      "strength",
      "dose",
      "frequency",
      "timing",
      "durationDays",
      "instructions",
    ]);
  });

  it("names the whole each way, so two copies compare as text", () => {
    const content = toContent({ items: [ROW], advice: "Rest", print_diagnosis: true });
    expect(content).toEqual({ items: [ITEM], advice: "Rest", printDiagnosis: true });
    expect(Object.keys(content)).toEqual(["items", "advice", "printDiagnosis"]);
    expect(toRow(content)).toEqual({ items: [ROW], advice: "Rest", print_diagnosis: true });
  });
});

describe("fromEmbedded (D45)", () => {
  const embedded = {
    id: "rx-1",
    advice: null,
    print_diagnosis: false,
    entered_by: "user-typist",
    typist: { full_name: "Priya Nair" },
    items: [
      { ...ROW, medicine: "Second", position: 2 },
      { ...ROW, position: 1 },
    ],
  };

  it("puts the medicines in their places, and names whoever typed it for the doctor", () => {
    expect(fromEmbedded(embedded, "user-doctor")).toEqual({
      id: "rx-1",
      items: [ITEM, { ...ITEM, medicine: "Second" }],
      advice: null,
      printDiagnosis: false,
      typedBy: "Priya Nair",
    });
    // The rows as read are left as they were.
    expect(embedded.items[0].position).toBe(2);
  });

  it("names no one when the doctor typed it, no one typed it, or the typist's account is gone", () => {
    expect(fromEmbedded({ ...embedded, entered_by: "user-doctor" }, "user-doctor").typedBy).toBeNull();
    expect(fromEmbedded({ ...embedded, entered_by: null, typist: null }, null).typedBy).toBeNull();
    expect(fromEmbedded({ ...embedded, typist: null }, "user-doctor").typedBy).toBeNull();
  });
});

describe("a medicine read out", () => {
  it("is titled by its name and strength", () => {
    expect(medicineTitle(ITEM)).toBe("Paracetamol 500 mg");
    expect(medicineTitle(BARE)).toBe("Cetirizine");
  });

  it("says how it is taken in one line, each part only when written", () => {
    expect(howTaken(ITEM)).toBe("1 tab · 1-0-1 · After food · 5 days");
    expect(howTaken({ ...BARE, durationDays: 1, timing: "BEDTIME" })).toBe("Bedtime · 1 day");
    expect(howTaken(BARE)).toBe("");
  });
});

describe("the prescription before this visit (D236)", () => {
  it("is named the screen's way", () => {
    expect(fromPrevious({ day: "2026-10-12", doctor_name: "Maya Rao", advice: "Rest", items: [ROW] })).toEqual({
      day: "2026-10-12",
      doctorName: "Maya Rao",
      advice: "Rest",
      items: [ITEM],
    });
  });
});

describe("a template's line (D241)", () => {
  it("names two medicines and counts the rest, or says it is advice alone", () => {
    expect(templateLine([ITEM])).toBe("Paracetamol");
    expect(templateLine([ITEM, BARE])).toBe("Paracetamol, Cetirizine");
    expect(templateLine([ITEM, BARE, ITEM])).toBe("Paracetamol, Cetirizine +1");
    expect(templateLine([])).toBe("Advice only");
  });
});

describe("advice added to what is typed (D238)", () => {
  it("fills an empty box, joins what is typed on a new line, and leaves out words already there", () => {
    expect(withAdvice("", "Rest")).toBe("Rest");
    expect(withAdvice("  ", "Rest")).toBe("Rest");
    expect(withAdvice("Fluids ", "Rest")).toBe("Fluids\nRest");
    expect(withAdvice("Fluids\nRest well", "Rest well ")).toBe("Fluids\nRest well");
    expect(withAdvice("Fluids", null)).toBe("Fluids");
    expect(withAdvice(undefined, "Rest")).toBe("Rest");
    expect(withAdvice(null, null)).toBe("");
  });
});
