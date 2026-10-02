import { paiseToRupees, roundToPaise } from "@/lib/money";

export const CURRENCY_SYMBOL = "₹";

// Built once: a formatter is costly to make, and every list row calls these.
const WHOLE_RUPEES = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const RUPEES_AND_PAISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * A rupee amount as a person reads it: "₹1,500", "₹1,500.50", "-₹4,590", or
 * "—" for nothing. The locale places the sign, so a loss reads "-₹4,590" and
 * never "₹-4,590"; only the text changes, never the value.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  // Rounded first, so -0.001 reads "₹0" rather than "-₹0".
  const value = roundToPaise(amount);
  const hasFraction = Math.round(value * 100) % 100 !== 0;
  return (hasFraction ? RUPEES_AND_PAISE : WHOLE_RUPEES).format(value);
}

/**
 * What every screen shows, because every amount the app stores is in paise
 * (AGENTS.md §16). No screen divides by 100 itself.
 */
export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return "—";
  return formatCurrency(paiseToRupees(paise));
}

// Largest first: an amount takes the first unit it reaches one of.
const COMPACT_UNITS = [
  { size: 10_000_000, suffix: "Cr" },
  { size: 100_000, suffix: "L" },
  { size: 1_000, suffix: "K" },
] as const;

/**
 * An amount short enough for a chart's axis: "₹2K", "₹1.5L", "₹1Cr", in the
 * Indian units people read (plan §18). One decimal at most. Rounding
 * is done before a unit is chosen, so ₹99,999 reads "₹1L", not "₹100K".
 * Only the axes use it: a value someone reads in full is `formatPaise`.
 */
export function formatPaiseCompact(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return "—";
  const rupees = paiseToRupees(paise);
  const sign = rupees < 0 ? "-" : "";
  const size = Math.abs(rupees);
  for (const unit of COMPACT_UNITS) {
    const scaled = Math.round((size / unit.size) * 10) / 10;
    if (scaled >= 1) {
      return `${sign}${CURRENCY_SYMBOL}${scaled.toLocaleString("en-IN", { maximumFractionDigits: 1 })}${unit.suffix}`;
    }
  }
  return `${sign}${CURRENCY_SYMBOL}${Math.round(size)}`;
}
