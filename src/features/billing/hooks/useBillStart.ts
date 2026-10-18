"use client";

import type { NewBillFor } from "@/constants/navigation";
import { useApiQuery } from "@/lib/query/useApiQuery";

import { billStartKey } from "../keys";
import type { BillStart } from "../types";

/** Where a new bill starts (plan §15.2): a visit, an arrival or a patient — nothing asked for no one yet (D313). */
export function useBillStart(target: NewBillFor | null) {
  return useApiQuery<BillStart>(target ? billStartKey(target) : null);
}
