import { PAGE_SIZE } from "@/constants/limits";
import { hasAccess } from "@/constants/permissions";
import { listPatientAppointments } from "@/features/appointments/api";
import type { PatientAppointment } from "@/features/appointments/types";
import { listPatientBills } from "@/features/billing/api";
import { listPatientPayments } from "@/features/billing/payments";
import type { PatientBill, Payment } from "@/features/billing/types";
import { listPatientVisits } from "@/features/visits/api";
import type { PatientVisit } from "@/features/visits/types";
import type { Page } from "@/lib/api/pagination";
import { allInOrder } from "@/lib/parallel";
import type { Tenant } from "@/lib/supabase/tenant";

import type { TimelineCursor, TimelineEntry } from "./types";

/** The parts of a history, in the order its cursor writes them. */
const PARTS = ["visits", "appointments", "bills", "payments"] as const;
type Part = (typeof PARTS)[number];

/** A history's first page: nothing shown yet of any part. */
const FIRST: TimelineCursor = { visits: 0, appointments: 0, bills: 0, payments: 0 };

/** A page of each part, newest first and one longer than a page. */
export interface TimelineParts {
  visits: PatientVisit[];
  appointments: PatientAppointment[];
  bills: PatientBill[];
  payments: Payment[];
}

/** An entry, and the moment it is placed at. */
interface Placed {
  entry: TimelineEntry;
  at: number;
  id: string;
}

/**
 * Whether one entry comes before another, newest first: the later moment —
 * a visit's opening, an appointment's time, a bill's issue, a payment's —
 * then, at the same moment, the larger id, as the database breaks its own
 * ties.
 */
const before = (one: Placed, other: Placed) => (one.at === other.at ? one.id > other.id : one.at > other.at);

/**
 * One page of the history from a page of each part, each newest first and
 * one longer than a page (D225, D325): merged in order — each part's own
 * order kept — to a page, and where the next starts in each part.
 */
export function mergeTimeline(parts: TimelineParts, start: TimelineCursor): Page<TimelineEntry> {
  const placed: Record<Part, Placed[]> = {
    visits: parts.visits.map((visit) => ({ entry: { visit }, at: Date.parse(visit.openedAt), id: visit.id })),
    appointments: parts.appointments.map((appointment) => ({
      entry: { appointment },
      at: Date.parse(appointment.scheduledAt),
      id: appointment.id,
    })),
    bills: parts.bills.map((bill) => ({ entry: { bill }, at: Date.parse(bill.issuedAt), id: bill.id })),
    payments: parts.payments.map((payment) => ({ entry: { payment }, at: Date.parse(payment.paidAt), id: payment.id })),
  };
  const shown: Record<Part, number> = { visits: 0, appointments: 0, bills: 0, payments: 0 };
  const items: TimelineEntry[] = [];
  while (items.length < PAGE_SIZE) {
    let next: Placed | undefined;
    let from: Part | undefined;
    for (const part of PARTS) {
      const head = placed[part][shown[part]];
      if (head !== undefined && (next === undefined || before(head, next))) [next, from] = [head, part];
    }
    if (next === undefined) break;
    items.push(next.entry);
    shown[from!] += 1;
  }
  const more = PARTS.some((part) => shown[part] < placed[part].length);
  return { items, nextCursor: more ? PARTS.map((part) => start[part] + shown[part]).join(".") : null };
}

const none = <T>() => Promise.resolve<T[]>([]);

/**
 * A page of a patient's history (plan §10.3; D167, D225, D325): their
 * visits, with `visits.view`; their appointments that have no visit, with
 * `appointments.view`; their bills and their payments, with `payments.view`
 * — one list, newest first, each part only for those who may see it, read
 * at once.
 */
export async function listPatientTimeline(
  tenant: Tenant,
  patientId: string,
  start: TimelineCursor = FIRST,
): Promise<Page<TimelineEntry>> {
  const money = hasAccess(tenant, "payments.view");
  const [visits, appointments, bills, payments] = await allInOrder([
    hasAccess(tenant, "visits.view") ? listPatientVisits(tenant, patientId, start.visits) : none<PatientVisit>(),
    hasAccess(tenant, "appointments.view")
      ? listPatientAppointments(tenant, patientId, start.appointments)
      : none<PatientAppointment>(),
    money ? listPatientBills(tenant, patientId, start.bills) : none<PatientBill>(),
    money ? listPatientPayments(tenant, patientId, start.payments) : none<Payment>(),
  ]);
  return mergeTimeline({ visits, appointments, bills, payments }, start);
}
