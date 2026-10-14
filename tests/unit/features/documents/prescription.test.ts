// @vitest-environment node
import { describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import { layoutPrescription, prescriptionSheet, vitalsLine } from "@/features/documents/prescription";
import type { PrescriptionSheet, PrescriptionSource } from "@/features/documents/types";
import type { Vitals } from "@/features/visits/types";
import type { Measure, PdfOp } from "@/lib/pdf/layout";
import { PDF_INNER } from "@/lib/pdf/render";

const { documents: words } = UI_TEXT;

/** Half the size a character, whatever the face: wide enough to wrap, simple enough to count. */
const measure: Measure = (text, _face, size) => text.length * size * 0.5;

const NONE: Vitals = {
  systolic: null,
  diastolic: null,
  pulse: null,
  temperatureF: null,
  spo2: null,
  respiratoryRate: null,
  weightKg: null,
  heightCm: null,
};

const ALL: Vitals = {
  systolic: 120,
  diastolic: 80,
  pulse: 72,
  temperatureF: 98.6,
  spo2: 98,
  respiratoryRate: 16,
  weightKg: 64.5,
  heightCm: 162,
};

const aSource = (changes: Partial<PrescriptionSource> = {}): PrescriptionSource => ({
  clinic: {
    name: "Smile Care",
    address: "12 MG Road",
    city: "Kochi",
    phone: "0484 234 5678",
    paperSize: "A5",
  },
  doctor: { name: "Maya Rao", qualifications: "BDS, MDS", specialization: "Orthodontist", registration: "KMC 12345" },
  patient: { name: "Rohan Mehta", number: 1002, dateOfBirth: "1990-06-15", gender: "MALE" },
  day: "2020-01-14",
  vitals: ALL,
  diagnosis: "Viral fever",
  prescription: {
    items: [
      {
        medicine: "Paracetamol",
        strength: "500 mg",
        dose: "1 tab",
        frequency: "1-0-1",
        timing: "AFTER_FOOD",
        durationDays: 5,
        instructions: null,
      },
      {
        medicine: "ORS sachet",
        strength: null,
        dose: null,
        frequency: null,
        timing: null,
        durationDays: null,
        instructions: "Dissolve in a litre of water",
      },
    ],
    advice: "Plenty of fluids",
    printDiagnosis: true,
  },
  followUpOn: "2020-01-21",
  ...changes,
});

const texts = (ops: PdfOp[]) => ops.flatMap((op) => (op.kind === "text" ? [op] : []));
const said = (ops: PdfOp[]) => texts(ops).map((op) => op.text);

describe("vitalsLine (plan §13)", () => {
  it("says every reading taken in one line, each with its unit, and the BMI from weight and height", () => {
    expect(vitalsLine(ALL)).toBe(
      "BP 120/80 mmHg · Pulse 72/min · Temp 98.6 °F · SpO₂ 98% · RR 16/min · Weight 64.5 kg · Height 162 cm · BMI 24.6",
    );
  });

  it("says only what was taken — no BMI without both — and nothing for none", () => {
    expect(vitalsLine({ ...NONE, pulse: 80, spo2: 97 })).toBe("Pulse 80/min · SpO₂ 97%");
    expect(vitalsLine({ ...NONE, weightKg: 70 })).toBe("Weight 70 kg");
    expect(vitalsLine({ ...NONE, heightCm: 170 })).toBe("Height 170 cm");
    expect(vitalsLine(NONE)).toBeNull();
    expect(vitalsLine(null)).toBeNull();
  });
});

describe("prescriptionSheet (D218, D219)", () => {
  it("puts the prescription in the words it is printed in", () => {
    expect(prescriptionSheet(aSource(), { logo: true })).toEqual({
      letterhead: { name: "Smile Care", address: "12 MG Road", city: "Kochi", phone: "0484 234 5678", logo: true },
      doctor: "Dr. Maya Rao",
      credentials: ["BDS, MDS · Orthodontist", "Reg. KMC 12345"],
      date: "14 Jan 2020",
      patient: "Rohan Mehta",
      // His age on the visit's day, not today's.
      about: "29 y · Male · P-1002",
      vitals: vitalsLine(ALL),
      diagnosis: "Viral fever",
      items: [
        { title: "Paracetamol 500 mg", how: "1 tab · 1-0-1 · After food · 5 days", instructions: null },
        { title: "ORS sachet", how: "", instructions: "Dissolve in a litre of water" },
      ],
      advice: "Plenty of fluids",
      followUp: "Review on Tuesday, 21 Jan 2020",
    });
  });

  it("names the doctor once, says what of their study there is, and leaves out what is not there", () => {
    const sheet = (doctor: Partial<PrescriptionSource["doctor"]>, changes: Partial<PrescriptionSource> = {}) =>
      prescriptionSheet(aSource({ doctor: { ...aSource().doctor, ...doctor }, ...changes }), { logo: false });
    expect(sheet({ name: "Dr. Maya Rao" }).doctor).toBe("Dr. Maya Rao");
    expect(sheet({ name: null }).doctor).toBeNull();
    expect(sheet({ qualifications: null }).credentials).toEqual(["Orthodontist", "Reg. KMC 12345"]);
    expect(sheet({ qualifications: null, specialization: null }).credentials).toEqual(["Reg. KMC 12345"]);
    const plain = sheet({}, { followUpOn: null, vitals: null, diagnosis: null });
    expect(plain).toMatchObject({ followUp: null, vitals: null, diagnosis: null, letterhead: { logo: false } });
  });
});

const sheetOf = (changes: Partial<PrescriptionSheet> = {}): PrescriptionSheet => ({
  ...prescriptionSheet(aSource(), { logo: false }),
  ...changes,
});

describe("layoutPrescription (D218, D219)", () => {
  it("lays out the clinic, the doctor and date, the patient, the vitals and diagnosis, then each medicine, the advice and the review", () => {
    const sheet = sheetOf();
    const layout = layoutPrescription(sheet, measure);
    const lines = said(layout.ops);
    expect(lines.slice(0, 3)).toEqual(["Smile Care", "12 MG Road, Kochi", "0484 234 5678"]);
    for (const line of [
      "Dr. Maya Rao",
      "14 Jan 2020",
      "BDS, MDS · Orthodontist",
      "Reg. KMC 12345",
      "Rohan Mehta",
      "29 y · Male · P-1002",
      `${words.diagnosis}:`,
      "Viral fever",
      words.rx,
      "1",
      "Paracetamol 500 mg",
      "1 tab · 1-0-1 · After food · 5 days",
      "2",
      "ORS sachet",
      "Dissolve in a litre of water",
      words.advice,
      "Plenty of fluids",
      "Review on Tuesday, 21 Jan 2020",
    ]) {
      expect(lines).toContain(line);
    }
    expect(lines.indexOf(words.rx)).toBeLessThan(lines.indexOf("Paracetamol 500 mg"));
    expect(lines.indexOf("Plenty of fluids")).toBeLessThan(lines.indexOf("Review on Tuesday, 21 Jan 2020"));

    // The date is set to the right edge, on the doctor's line.
    const [doctor, date] = ["Dr. Maya Rao", "14 Jan 2020"].map((text) =>
      texts(layout.ops).find((op) => op.text === text)!,
    );
    expect(date.y).toBe(doctor.y);
    expect(date.x + measure(date.text, date.face, date.size)).toBeCloseTo(PDF_INNER);

    // The patient and their details share a line; a medicine's number stands beside its name.
    const [name, about] = ["Rohan Mehta", "29 y · Male · P-1002"].map((text) =>
      texts(layout.ops).find((op) => op.text === text)!,
    );
    expect(about.y).toBe(name.y);
    const [one, first] = ["1", "Paracetamol 500 mg"].map((text) => texts(layout.ops).find((op) => op.text === text)!);
    expect(one.y).toBe(first.y);
    expect(first.x).toBeGreaterThan(one.x);

    expect(layout.running).toBe(words.running("Rohan Mehta", "29 y · Male · P-1002", "14 Jan 2020"));
  });

  it("breaks the vitals' line only between readings", () => {
    const layout = layoutPrescription(sheetOf(), measure);
    // The vitals alone are in ink at 8 pt.
    const vitals = texts(layout.ops)
      .filter((op) => op.size === 8 && op.color === "ink")
      .map((op) => op.text);
    expect(vitals.length).toBeGreaterThan(1);
    expect(vitals.join(" · ")).toBe(vitalsLine(ALL));
    for (const line of vitals) expect(line).not.toMatch(/(^|· )\d/);
  });

  it("may end a page after the patient, after each medicine, and around the advice and the review", () => {
    const full = layoutPrescription(sheetOf(), measure);
    expect(full.breaks).toHaveLength(1 + 2 + 1 + 1);
    expect([...full.breaks].sort((a, b) => a - b)).toEqual(full.breaks);
    expect(full.breaks.at(-1)).toBe(full.height);

    const bare = layoutPrescription(sheetOf({ advice: null, followUp: null }), measure);
    expect(bare.breaks).toHaveLength(1 + 2);
  });

  it("signs at the foot: a line at the right edge, the doctor's name under it", () => {
    const { foot } = layoutPrescription(sheetOf(), measure);
    const rule = foot!.ops.find((op) => op.kind === "rule")!;
    expect(rule).toMatchObject({ x: PDF_INNER - 130, width: 130, color: "ink" });
    const name = texts(foot!.ops).find((op) => op.text === "Dr. Maya Rao")!;
    expect(name.x + measure(name.text, name.face, name.size)).toBeCloseTo(PDF_INNER);
    expect(name.y).toBeGreaterThan(rule.y);
    expect(foot!.height).toBeGreaterThan(name.y - name.size);
  });

  it("leaves out what the visit does not have, and a doctor whose account is gone", () => {
    const layout = layoutPrescription(
      sheetOf({ doctor: null, vitals: null, diagnosis: null, advice: null, followUp: null }),
      measure,
    );
    const lines = said(layout.ops);
    expect(lines).not.toContain(`${words.diagnosis}:`);
    expect(lines).not.toContain(words.advice);
    expect(lines.some((line) => line.startsWith("BP"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Review"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Dr."))).toBe(false);
    expect(lines).toContain("14 Jan 2020");
    expect(said(layout.foot!.ops)).toEqual([]);
    expect(layout.foot!.ops.map((op) => op.kind)).toEqual(["rule"]);
  });
});
