import { hasAccess } from "@/constants/permissions";
import { nextAppointment } from "@/features/appointments/api";
import type { Tenant } from "@/lib/supabase/tenant";

import type { PatientSummary } from "./types";

/**
 * Where a patient stands (plan §10.3): each part only for those who may see
 * it — for now their next appointment (D166), with `appointments.view`. Open
 * treatments and the balance join it as their phases arrive (D101). The parts
 * are read at once.
 */
export async function getPatientSummary(tenant: Tenant, patientId: string): Promise<PatientSummary> {
  if (!hasAccess(tenant, "appointments.view")) return {};
  return { nextAppointment: await nextAppointment(tenant, patientId) };
}
