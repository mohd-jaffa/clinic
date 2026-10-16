import type { DiscountKind } from "@/constants/statuses";
import { sumPaise } from "@/lib/money";

/**
 * What a bill comes to (plan §15.1; D290 – D293): the one formula, used by
 * the new bill's live preview and by the server before it issues — and the
 * database works it out again, refusing a bill whose subtotal or total
 * differ (0028's create_bill). Whole paise throughout, never a float.
 */
export interface BillLine {
  quantity: number;
  /** Whole paise. */
  unitPricePaise: number;
}

/** A bill's discount, as it is given: an amount in paise, or a whole percentage (D291). */
export type BillDiscount =
  | { kind: Extract<DiscountKind, "AMOUNT">; paise: number }
  | { kind: Extract<DiscountKind, "PERCENT">; percent: number };

export interface BillTotals {
  subtotal: number;
  discount: number;
  total: number;
}

/** A line's amount: its quantity times its price. */
export function lineAmount({ quantity, unitPricePaise }: BillLine): number {
  return quantity * unitPricePaise;
}

/**
 * A discount in paise, as the bill stores it (D292). An amount stands as
 * typed: more than the subtotal leaves the total below nothing, for the form
 * to refuse at the field (D293). A percentage is of the subtotal, rounded to
 * the nearest rupee, half up (D290), worked out in integers — and never past
 * the subtotal, so 100% is the whole of it even when that ends in paise.
 */
export function discountPaise(subtotal: number, discount: BillDiscount | null): number {
  if (!discount) return 0;
  if (discount.kind === "AMOUNT") return discount.paise;
  const rupees = Math.floor((subtotal * discount.percent + 5_000) / 10_000);
  return Math.min(subtotal, rupees * 100);
}

/** What a bill comes to: its lines added up, less the discount. */
export function billTotals(lines: readonly BillLine[], discount: BillDiscount | null): BillTotals {
  const subtotal = sumPaise(lines.map(lineAmount));
  const off = discountPaise(subtotal, discount);
  return { subtotal, discount: off, total: subtotal - off };
}
