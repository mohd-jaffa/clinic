/**
 * The bounds of each vital sign (plan §12.2): what a reading may be, for a
 * newborn and an adult alike, so a slip of the finger is caught and a real
 * reading never refused. The vitals table's CHECKs in 0018 hold the same
 * numbers; tests/db keeps them equal. Temperature in °F (D31).
 */
export const VITAL_LIMITS = {
  /** Blood pressure, mmHg; the lower reading below the upper. */
  systolic: { min: 50, max: 260 },
  diastolic: { min: 30, max: 160 },
  /** Beats a minute. */
  pulse: { min: 20, max: 250 },
  /** °F, to one decimal. */
  temperatureF: { min: 90, max: 110 },
  /** Oxygen saturation, %. */
  spo2: { min: 50, max: 100 },
  /** Breaths a minute. */
  respiratoryRate: { min: 5, max: 70 },
  /** Kilograms, to two decimals. */
  weightKg: { min: 0.5, max: 350 },
  /** Centimetres, to one decimal. */
  heightCm: { min: 20, max: 250 },
} as const;

export type VitalSign = keyof typeof VITAL_LIMITS;
