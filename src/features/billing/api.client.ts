import { postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { BillInput } from "@/lib/validation";

import type { BillIssued } from "./types";

/** The billing endpoints the browser calls (plan §30): a bill issued once per key, however often it is sent. */
export const BillingClient = {
  issue: ({ input, key }: { input: BillInput; key: string }) => postOnce<BillIssued>(apiRoutes.bills.list, input, key),
};
