"use client";

import type { DayRange } from "@/lib/dates/range";
import { useApiPages } from "@/lib/query/useApiPages";

import { paymentsKey } from "../keys";
import type { Payment } from "../types";

/** A page at a time of the payments and refunds paid on some days (plan §15.4; D320). */
export function usePayments(range: DayRange) {
  return useApiPages<Payment>(paymentsKey(range));
}
