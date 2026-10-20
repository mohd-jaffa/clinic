"use client";

import type { BillListState } from "@/constants/statuses";
import type { DayRange } from "@/lib/dates/range";
import { useApiPages } from "@/lib/query/useApiPages";

import { billsKey } from "../keys";
import type { BillListItem } from "../types";

/** A page at a time of the bills issued on some days (plan §15.4; D320): every state, or one. */
export function useBills(range: DayRange, state?: BillListState) {
  return useApiPages<BillListItem>(billsKey(range, state));
}
