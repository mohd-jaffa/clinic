import { describe, expect, it } from "vitest";

import { VITAL_SIGNS } from "@/constants/clinical";
import type { Vitals, VitalsRow } from "@/features/visits/types";
import {
  anyReading,
  bmiOf,
  formatReading,
  toVitals,
  toVitalsRow,
  VITAL_COLUMNS,
  vitalLabel,
  vitalsInput,
} from "@/features/visits/vitals";

const vitals: Vitals = {
  systolic: 120,
  diastolic: 80,
  pulse: 72,
  temperatureF: 98.6,
  spo2: 98,
  respiratoryRate: 16,
  weightKg: 64.5,
  heightCm: 162,
};
const row: VitalsRow = {
  systolic: 120,
  diastolic: 80,
  pulse: 72,
  temperature_f: 98.6,
  spo2: 98,
  respiratory_rate: 16,
  weight_kg: 64.5,
  height_cm: 162,
};
const none = Object.fromEntries(VITAL_SIGNS.map((sign) => [sign, null])) as unknown as Vitals;

describe("the vitals (plan §12.2)", () => {
  it("name each reading's column, and read a row both ways", () => {
    expect(Object.keys(VITAL_COLUMNS)).toEqual(VITAL_SIGNS);
    expect(toVitals(row)).toEqual(vitals);
    expect(toVitalsRow(vitals)).toEqual(row);
  });

  it("say whether any reading is taken", () => {
    expect(anyReading(null)).toBe(false);
    expect(anyReading(none)).toBe(false);
    expect(anyReading({ ...none, spo2: 97 })).toBe(true);
  });

  it("work out the BMI to one decimal, only with both weight and height", () => {
    expect(bmiOf(vitals)).toBe(24.6);
    expect(bmiOf({ weightKg: 64.5, heightCm: null })).toBeNull();
    expect(bmiOf({ weightKg: null, heightCm: 162 })).toBeNull();
  });

  it("label each reading with its unit, blood pressure in mmHg", () => {
    expect(VITAL_SIGNS.map(vitalLabel)).toEqual([
      "Systolic (mmHg)",
      "Diastolic (mmHg)",
      "Pulse (/min)",
      "Temperature (°F)",
      "SpO₂ (%)",
      "Respiratory rate (/min)",
      "Weight (kg)",
      "Height (cm)",
    ]);
  });

  it("read a reading out to no more decimals than it was taken to, never grouped", () => {
    expect(formatReading(98.6, 1)).toBe("98.6");
    expect(formatReading(64, 2)).toBe("64");
    expect(formatReading(64.555, 2)).toBe("64.56");
    expect(formatReading(1200, 0)).toBe("1200");
  });

  it("fill the fields from a copy, blank for none", () => {
    expect(vitalsInput(null)).toEqual(Object.fromEntries(VITAL_SIGNS.map((sign) => [sign, ""])));
    expect(vitalsInput({ ...none, temperatureF: 98.6, weightKg: 64.5 })).toEqual({
      systolic: "",
      diastolic: "",
      pulse: "",
      temperatureF: "98.6",
      spo2: "",
      respiratoryRate: "",
      weightKg: "64.5",
      heightCm: "",
    });
  });
});
