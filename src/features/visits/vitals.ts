import { VITAL_SIGNS, type VitalSign } from "@/constants/clinical";
import { UI_TEXT } from "@/constants/messages";
import type { VitalsInput } from "@/lib/validation";

import type { Vitals, VitalsRow } from "./types";

/** Each reading's column in the vitals table. */
export const VITAL_COLUMNS: Record<VitalSign, keyof VitalsRow> = {
  systolic: "systolic",
  diastolic: "diastolic",
  pulse: "pulse",
  temperatureF: "temperature_f",
  spo2: "spo2",
  respiratoryRate: "respiratory_rate",
  weightKg: "weight_kg",
  heightCm: "height_cm",
};

/** The readings as a screen holds them, from the row. */
export function toVitals(row: VitalsRow): Vitals {
  return Object.fromEntries(VITAL_SIGNS.map((sign) => [sign, row[VITAL_COLUMNS[sign]]])) as unknown as Vitals;
}

/** The readings as the database names them, from what a screen holds. */
export function toVitalsRow(vitals: Vitals): VitalsRow {
  return Object.fromEntries(VITAL_SIGNS.map((sign) => [VITAL_COLUMNS[sign], vitals[sign]])) as unknown as VitalsRow;
}

/** Whether any reading is taken. */
export const anyReading = (vitals: Vitals | null): boolean =>
  vitals !== null && VITAL_SIGNS.some((sign) => vitals[sign] !== null);

/**
 * Body-mass index for display (plan §12.2): weight over height squared, to
 * one decimal — none unless both are taken. Worked out here, never stored.
 */
export function bmiOf({ weightKg, heightCm }: Pick<Vitals, "weightKg" | "heightCm">): number | null {
  if (weightKg === null || heightCm === null) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

const { vitals: words } = UI_TEXT;

/** Each reading's name with its unit, as its field and read-out show it: "Temperature (°F)". */
export function vitalLabel(sign: VitalSign): string {
  const unit =
    sign === "systolic" || sign === "diastolic"
      ? words.units.bloodPressure
      : words.units[sign as keyof typeof words.units];
  return `${words[sign]} (${unit})`;
}

/** A reading as it is read out: "98.6", "64.5" — never more decimals than it was taken to. */
export const formatReading = (value: number, places: number): string =>
  value.toLocaleString("en-IN", { maximumFractionDigits: places, useGrouping: false });

/** The vitals' fields for a copy of them: each reading as typed, blank for none. */
export const vitalsInput = (vitals: Vitals | null): VitalsInput =>
  Object.fromEntries(
    VITAL_SIGNS.map((sign) => [sign, vitals === null || vitals[sign] === null ? "" : String(vitals[sign])]),
  ) as VitalsInput;
