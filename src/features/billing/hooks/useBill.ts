"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { BillDetail } from "../types";

/** A bill (plan §15.2; D314): its page's read, and a void bill's lines to issue again — nothing asked for none. */
export function useBill(id: string | null) {
  return useApiQuery<BillDetail>(id ? apiRoutes.bills.one(id) : null);
}
