import { PAGE_SIZE } from "@/constants/limits";
import { hasAccess } from "@/constants/permissions";
import { listPatientAppointments } from "@/features/appointments/api";
import type { PatientAppointment } from "@/features/appointments/types";
import { listPatientVisits } from "@/features/visits/api";
import type { PatientVisit } from "@/features/visits/types";
import type { Page } from "@/lib/api/pagination";
import { allInOrder } from "@/lib/parallel";
import type { Tenant } from "@/lib/supabase/tenant";

import type { TimelineCursor, TimelineEntry } from "./types";

/** A history's first page: nothing shown yet of either. */
const FIRST: TimelineCursor = { visits: 0, appointments: 0 };

/**
 * Whether a visit comes before an appointment, newest first: the later
 * moment — a visit's opening, an appointment's time — then, at the same
 * moment, the larger id, as the database breaks its own ties.
 */
function visitFirst(visit: PatientVisit, appointment: PatientAppointment): boolean {
  const [opened, scheduled] = [Date.parse(visit.openedAt), Date.parse(appointment.scheduledAt)];
  return opened === scheduled ? visit.id > appointment.id : opened > scheduled;
}

/**
 * One page of the history from a page of each part, each newest first and
 * one longer than a page (D225): merged in order — each part's own order
 * kept — to a page, and where the next starts in each part.
 */
export function mergeTimeline(
  visits: PatientVisit[],
  appointments: PatientAppointment[],
  start: TimelineCursor,
): Page<TimelineEntry> {
  const items: TimelineEntry[] = [];
  let [shownVisits, shownAppointments] = [0, 0];
  while (items.length < PAGE_SIZE && (shownVisits < visits.length || shownAppointments < appointments.length)) {
    const [visit, appointment] = [visits[shownVisits], appointments[shownAppointments]];
    if (appointment === undefined || (visit !== undefined && visitFirst(visit, appointment))) {
      items.push({ visit });
      shownVisits += 1;
    } else {
      items.push({ appointment });
      shownAppointments += 1;
    }
  }
  const more = shownVisits < visits.length || shownAppointments < appointments.length;
  return {
    items,
    nextCursor: more ? `${start.visits + shownVisits}.${start.appointments + shownAppointments}` : null,
  };
}

/**
 * A page of a patient's history (plan §10.3; D167, D225): their visits, with
 * `visits.view`, and their appointments that have no visit, with
 * `appointments.view` — one list, newest first, each part only for those who
 * may see it, read at once. Bills and payments join it in Phase 8 (D101).
 */
export async function listPatientTimeline(
  tenant: Tenant,
  patientId: string,
  start: TimelineCursor = FIRST,
): Promise<Page<TimelineEntry>> {
  const [visits, appointments] = await allInOrder([
    hasAccess(tenant, "visits.view") ? listPatientVisits(tenant, patientId, start.visits) : Promise.resolve([]),
    hasAccess(tenant, "appointments.view")
      ? listPatientAppointments(tenant, patientId, start.appointments)
      : Promise.resolve([]),
  ]);
  return mergeTimeline(visits, appointments, start);
}
