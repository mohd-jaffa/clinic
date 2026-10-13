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

/** The readings in the order a visit shows them (plan §12.2). */
export const VITAL_SIGNS = Object.keys(VITAL_LIMITS) as VitalSign[];

/**
 * How finely each reading is taken: whole numbers, but temperature to 0.1 °F,
 * weight to 0.01 kg and height to 0.1 cm — as the vitals table's columns
 * hold them.
 */
export const VITAL_DECIMALS: Record<VitalSign, number> = {
  systolic: 0,
  diastolic: 0,
  pulse: 0,
  temperatureF: 1,
  spo2: 0,
  respiratoryRate: 0,
  weightKg: 2,
  heightCm: 1,
};

/**
 * The follow-up chips beside the date (D205): a review this long after the
 * visit's day. Any other day is picked from the calendar.
 */
export const FOLLOW_UP_CHOICES = [
  { key: "3_DAYS", days: 3 },
  { key: "1_WEEK", days: 7 },
  { key: "2_WEEKS", days: 14 },
  { key: "1_MONTH", months: 1 },
] as const;

export type FollowUpChoice = (typeof FOLLOW_UP_CHOICES)[number]["key"];
