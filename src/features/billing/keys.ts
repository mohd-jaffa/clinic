import type { NewBillFor } from "@/constants/navigation";
import { apiRoutes, withQuery } from "@/lib/query/keys";
import { billStartQuerySchema } from "@/lib/validation";

import type { BillStart } from "./types";

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

/** The same, from a page's search params: a name given twice is none. */
export const billTargetIn = (params: Record<string, string | string[] | undefined>) =>
  billTargetOf((name) => {
    const value = params[name];
    return typeof value === "string" ? value : undefined;
  });

/**
 * What issuing a bill makes stale: where bills start, today's queue (its
 * Fee paid, D306), the patient's profile, and the visit or arrival billed.
 */
export const billIssuedRoutes = (start: BillStart) => [
  apiRoutes.bills.start,
  apiRoutes.queue.list,
  apiRoutes.patients.summary(start.patient.id),
  apiRoutes.patients.timeline(start.patient.id),
  ...(start.visit ? [apiRoutes.visits.one(start.visit.id)] : []),
  ...(start.appointment ? [apiRoutes.appointments.one(start.appointment.id)] : []),
];
