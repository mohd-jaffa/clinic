import type { SubscriptionState } from "@/constants/statuses";
import { addDaysKey } from "@/lib/dates/calendar";

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
