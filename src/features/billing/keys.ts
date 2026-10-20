import { BILL_REISSUE, type NewBillFor } from "@/constants/navigation";
import type { BillListState } from "@/constants/statuses";
import type { DayRange } from "@/lib/dates/range";
import { apiRoutes, withQuery } from "@/lib/query/keys";
import { billIdSchema, billStartQuerySchema } from "@/lib/validation";

import type { BillDetail, BillStart } from "./types";

/** Where a new bill starts (plan §15.2): the page's first read and the screen's hook ask for the very same thing. */
export const billStartKey = (target: NewBillFor) => withQuery(apiRoutes.bills.start, target);

/**
 * What a new bill's address names it for (D313): a visit, an arrival or a
 * patient — or, with none, or one that is not an id, no one yet.
 */
export function billTargetOf(read: (name: "visit" | "appointment" | "patient") => string | null | undefined) {
  const parsed = billStartQuerySchema.safeParse({
    visit: read("visit") ?? undefined,
    appointment: read("appointment") ?? undefined,
    patient: read("patient") ?? undefined,
  });
  if (!parsed.success) return null;
  const { visit, appointment, patient } = parsed.data;
  const target: NewBillFor = visit ? { visit } : appointment ? { appointment } : { patient: patient! };
  return target;
}

/** The void bill a new one issues again (D314), when the address names one by its id. */
export const reissueOf = (value: string | null | undefined) => {
  const parsed = billIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/** The same, from a page's search params. */
export const reissueIn = (params: Record<string, string | string[] | undefined>) => {
  const value = params[BILL_REISSUE];
  return reissueOf(typeof value === "string" ? value : null);
};

/** The same, from a page's search params: a name given twice is none. */
export const billTargetIn = (params: Record<string, string | string[] | undefined>) =>
  billTargetOf((name) => {
    const value = params[name];
    return typeof value === "string" ? value : undefined;
  });

/** What any bill issued or voided makes stale in Billing (plan §15.4): its tabs, To bill's count, and the patients' chips. */
const BILLING_LISTS = [
  apiRoutes.toBill.list,
  apiRoutes.toBill.count,
  apiRoutes.bills.list,
  apiRoutes.payments.list,
  apiRoutes.outstanding.list,
  apiRoutes.patients.search,
];

/**
 * What issuing a bill makes stale: where bills start, today's queue (its
 * Fee paid, D306), Billing's lists, the patient's profile, and the visit or
 * arrival billed.
 */
export const billIssuedRoutes = (start: BillStart) => [
  apiRoutes.bills.start,
  apiRoutes.queue.list,
  ...BILLING_LISTS,
  apiRoutes.patients.summary(start.patient.id),
  apiRoutes.patients.timeline(start.patient.id),
  ...(start.visit ? [apiRoutes.visits.one(start.visit.id)] : []),
  ...(start.appointment ? [apiRoutes.appointments.one(start.appointment.id)] : []),
];

/**
 * What voiding a bill makes stale: the bill, where bills start, today's
 * queue (Fee paid, To bill), Billing's lists, the patient's profile, and
 * the visit or arrival it billed.
 */
export const billVoidedRoutes = (bill: BillDetail) => [
  apiRoutes.bills.one(bill.id),
  apiRoutes.bills.start,
  apiRoutes.queue.list,
  ...BILLING_LISTS,
  apiRoutes.patients.summary(bill.patient.id),
  apiRoutes.patients.timeline(bill.patient.id),
  ...(bill.visitId ? [apiRoutes.visits.one(bill.visitId)] : []),
  ...(bill.appointmentId ? [apiRoutes.appointments.one(bill.appointmentId)] : []),
];

/** To bill (D318): one doctor's or every doctor's — the page's first read and the screen's hook ask for the same. */
export const toBillKey = (doctorId?: string) => withQuery(apiRoutes.toBill.list, { doctorId });

/** How many wait in To bill (D337): one doctor's, or every doctor's. */
export const toBillCountKey = (doctorId?: string) => withQuery(apiRoutes.toBill.count, { doctorId });

/** Billing's Bills tab (D320): its days, and a state — or every state. */
export const billsKey = ({ from, to }: DayRange, state?: BillListState) =>
  withQuery(apiRoutes.bills.list, { from, to, state });

/** Billing's Payments tab (D320): its days. */
export const paymentsKey = ({ from, to }: DayRange) => withQuery(apiRoutes.payments.list, { from, to });

/**
 * What a payment recorded or voided makes stale: Billing's payments, bills
 * (their states) and who owes; where bills start (the balance); the
 * patients list (its chips and Owing tab); the patient's profile and
 * history; and the bill it was recorded from, if any.
 */
export const paymentRoutes = (patientId: string, billId?: string) => [
  apiRoutes.payments.list,
  apiRoutes.bills.list,
  apiRoutes.outstanding.list,
  apiRoutes.bills.start,
  apiRoutes.patients.search,
  apiRoutes.patients.summary(patientId),
  apiRoutes.patients.timeline(patientId),
  ...(billId ? [apiRoutes.bills.one(billId)] : []),
];

/**
 * What No charge makes stale (D319): To bill and its count, today's queue
 * (Done), where bills start, the patient's history, and the visit.
 */
export const noChargeRoutes = (visitId: string, patientId: string) => [
  apiRoutes.toBill.list,
  apiRoutes.toBill.count,
  apiRoutes.queue.list,
  apiRoutes.bills.start,
  apiRoutes.patients.timeline(patientId),
  apiRoutes.visits.one(visitId),
];
