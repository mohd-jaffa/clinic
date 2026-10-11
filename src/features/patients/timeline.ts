import { hasAccess } from "@/constants/permissions";
import { listPatientAppointments } from "@/features/appointments/api";
import type { PatientAppointment } from "@/features/appointments/types";
import type { Page } from "@/lib/api/pagination";
import type { Tenant } from "@/lib/supabase/tenant";

/**
 * A page of a patient's history (plan §10.3): each part only for those who
 * may see it — for now their appointments, newest first (D167), with
 * `appointments.view`. Visits, bills and payments join it as their phases
 * arrive (D101).
 */
export async function listPatientTimeline(
  tenant: Tenant,
  patientId: string,
  start?: number,
): Promise<Page<PatientAppointment>> {
  if (!hasAccess(tenant, "appointments.view")) return { items: [], nextCursor: null };
  return listPatientAppointments(tenant, patientId, start);
}
