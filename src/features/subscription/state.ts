import type { PlatformSettings } from "@/constants/platform";
import type { ExtensionKind, SubscriptionPlan, SubscriptionState } from "@/constants/statuses";
import { addDaysKey, addMonthsKey } from "@/lib/dates/calendar";

/** What a clinic's state is worked out from (plan §7.2): days as YYYY-MM-DD in the clinic's timezone. */
export interface SubscriptionDates {
  /** The plan's last day of access, inclusive. */
  validUntil: string;
  today: string;
  /** `expiry_warning_days` and `grace_days` from the live platform settings. */
  warningDays: number;
  graceDays: number;
}

/**
 * Where a clinic's plan stands (plan §7.2). The same rule as the database's
 * `subscription_state_for()` (0005), kept equal by a test: the database
 * applies it to refuse writes, and the server to tell the screens.
 */
export function subscriptionState({ validUntil, today, warningDays, graceDays }: SubscriptionDates): SubscriptionState {
  if (today <= addDaysKey(validUntil, -warningDays)) return "ACTIVE";
  if (today <= validUntil) return "EXPIRING";
  if (today <= addDaysKey(validUntil, graceDays)) return "GRACE";
  return "READ_ONLY";
}

/** The first day the clinic is view-only: the day after its grace ends. */
export function readOnlyFrom(validUntil: string, graceDays: number): string {
  return addDaysKey(validUntil, graceDays + 1);
}

/** A clinic's plan as the screens are told it: the plan, its last day, its state, and its first view-only day. */
export interface PlanStanding {
  plan: SubscriptionPlan;
  /** The last day of access, inclusive: YYYY-MM-DD in the clinic's timezone. */
  validUntil: string;
  state: SubscriptionState;
  readOnlyFrom: string;
}

/** Where a plan stands on `today`, by the live settings' warning and grace (plan §7.2). */
export function standingOf(
  { plan, validUntil }: Pick<PlanStanding, "plan" | "validUntil">,
  { expiryWarningDays, graceDays }: Pick<PlatformSettings, "expiryWarningDays" | "graceDays">,
  today: string,
): PlanStanding {
  return {
    plan,
    validUntil,
    state: subscriptionState({ validUntil, today, warningDays: expiryWarningDays, graceDays }),
    readOnlyFrom: readOnlyFrom(validUntil, graceDays),
  };
}

/**
 * The last day a Monthly or a Yearly extension runs to (plan §7.4): a
 * calendar month, or twelve, on from the later of the plan's last day and
 * yesterday — so paying early never loses a day, and paying late starts from
 * today. The same rule as `extend_clinic_subscription()` (0036), kept equal
 * by a test: the console shows it before the DEV saves.
 */
export function periodEnd(kind: Exclude<ExtensionKind, "CUSTOM">, validUntil: string, today: string): string {
  const yesterday = addDaysKey(today, -1);
  return addMonthsKey(validUntil > yesterday ? validUntil : yesterday, kind === "MONTHLY" ? 1 : 12);
}
