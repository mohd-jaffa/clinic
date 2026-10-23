import { hasAccess } from "@/constants/permissions";
import { nextAppointment } from "@/features/appointments/api";
import { getPatientBalance } from "@/features/billing/payments";
import { listPatientTreatments } from "@/features/treatments/api";
import { allInOrder } from "@/lib/parallel";
import type { Tenant } from "@/lib/supabase/tenant";

import type { PatientSummary } from "./types";

/**
 * Where a patient stands (plan §10.3): each part only for those who may see
 * it — their next appointment (D166), with `appointments.view`; their
 * treatments (D260), with `visits.view`; and their balance, with
 * `payments.view` (D101). The parts are read at once.
 */
export async function getPatientSummary(tenant: Tenant, patientId: string): Promise<PatientSummary> {
  const [next, treatments, balance] = await allInOrder([
    hasAccess(tenant, "appointments.view") ? nextAppointment(tenant, patientId) : Promise.resolve(undefined),
    hasAccess(tenant, "visits.view") ? listPatientTreatments(tenant, patientId) : Promise.resolve(undefined),
    hasAccess(tenant, "payments.view") ? getPatientBalance(tenant, patientId) : Promise.resolve(undefined),
  ]);
  return {
    ...(next !== undefined && { nextAppointment: next }),
    ...(treatments !== undefined && { treatments }),
    ...(balance !== undefined && { balancePaise: balance }),
  };
}
