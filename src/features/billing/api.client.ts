import { postJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { BillInput, VoidBillInput } from "@/lib/validation";

import type { BillIssued, BillVoided } from "./types";

/** The billing endpoints the browser calls (plan §30): a bill issued once per key, however often it is sent; voided. */
export const BillingClient = {
  issue: ({ input, key }: { input: BillInput; key: string }) => postOnce<BillIssued>(apiRoutes.bills.list, input, key),
  void: ({ billId, input }: { billId: string; input: VoidBillInput }) =>
    postJson<BillVoided>(apiRoutes.bills.void(billId), input),
};
