import { postJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { BillInput, NoChargeInput, PaymentInput, VoidBillInput, VoidPaymentInput } from "@/lib/validation";

import type { BillIssued, BillVoided, NoChargeMarked, PaymentRecorded, PaymentVoided } from "./types";

/**
 * The billing endpoints the browser calls (plan §30): a bill issued, or a
 * payment recorded, once per key, however often it is sent; either voided;
 * a visit settled No charge.
 */
export const BillingClient = {
  issue: ({ input, key }: { input: BillInput; key: string }) => postOnce<BillIssued>(apiRoutes.bills.list, input, key),
  void: ({ billId, input }: { billId: string; input: VoidBillInput }) =>
    postJson<BillVoided>(apiRoutes.bills.void(billId), input),
  record: ({ input, key }: { input: PaymentInput; key: string }) =>
    postOnce<PaymentRecorded>(apiRoutes.payments.list, input, key),
  voidPayment: ({ paymentId, input }: { paymentId: string; input: VoidPaymentInput }) =>
    postJson<PaymentVoided>(apiRoutes.payments.void(paymentId), input),
  noCharge: ({ visitId, input }: { visitId: string; input: NoChargeInput }) =>
    postJson<NoChargeMarked>(apiRoutes.visits.noCharge(visitId), input),
};
