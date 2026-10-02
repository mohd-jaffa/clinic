import type { FeeTiming, PaperSize, ServiceCategory } from "./statuses";

/**
 * What a new clinic starts with (plan §5.1, AGENTS.md §10). The clinic changes
 * all of it from its own settings afterwards; this is only the first state.
 * `register_clinic` (0008) seeds exactly these, and tests/db keeps the two
 * equal.
 */

/** The appointment types a clinic starts with, and how long each takes (D32). */
export const DEFAULT_APPOINTMENT_TYPES: readonly { name: string; minutes: number }[] = [
  { name: "Consultation", minutes: 15 },
  { name: "Follow-up", minutes: 10 },
  { name: "Procedure", minutes: 30 },
  { name: "Review", minutes: 15 },
  { name: "Other", minutes: 15 },
];

/** The expense categories a clinic starts with (plan §16, D40). */
export const DEFAULT_EXPENSE_CATEGORIES: readonly string[] = [
  "Rent",
  "Electricity",
  "Equipment",
  "Medicine",
  "Supplies",
  "Salary",
  "Maintenance",
  "Marketing",
  "Other",
];

/** The one price-list entry a clinic starts with, for the owner to price (plan §5.1). */
export const DEFAULT_CONSULTATION_SERVICE: { name: string; category: ServiceCategory; pricePaise: number } = {
  name: "Consultation",
  category: "CONSULTATION",
  pricePaise: 0,
};

/**
 * A new clinic's own settings (plan §9): A4, the paper every office printer
 * holds, and the fee collected at checkout with everything else (§15.6).
 */
export const DEFAULT_CLINIC_SETTINGS: { paperSize: PaperSize; feeTiming: FeeTiming } = {
  paperSize: "A4",
  feeTiming: "AFTER_CONSULTATION",
};
