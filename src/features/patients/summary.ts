import { hasAccess } from "@/constants/permissions";
import { nextAppointment } from "@/features/appointments/api";
import { listPatientTreatments } from "@/features/treatments/api";
import { allInOrder } from "@/lib/parallel";
import type { Tenant } from "@/lib/supabase/tenant";

import type { PatientSummary } from "./types";

/**
 * Where a patient stands (plan §10.3): each part only for those who may see
 * it — their next appointment (D166), with `appointments.view`, and their
 * treatments (D260), with `visits.view`. The balance joins it with Phase 8
 * (D101). The parts are read at once.
 */
export async function getPatientSummary(tenant: Tenant, patientId: string): Promise<PatientSummary> {
  const [next, treatments] = await allInOrder([
    hasAccess(tenant, "appointments.view") ? nextAppointment(tenant, patientId) : Promise.resolve(undefined),
    hasAccess(tenant, "visits.view") ? listPatientTreatments(tenant, patientId) : Promise.resolve(undefined),
  ]);
  return {
    ...(next !== undefined && { nextAppointment: next }),
    ...(treatments !== undefined && { treatments }),
  };
}
