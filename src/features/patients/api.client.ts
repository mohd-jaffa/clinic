import { patchJson, postJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { AlertInput, PatientInput, UpdateAlertInput, UpdatePatientInput } from "@/lib/validation";

import type { Patient, PatientAlert } from "./types";

/**
 * The patients' endpoints the browser calls (plan §30): adding one — once per
 * key, however often it is sent — and changing one. What is looked up about
 * a patient goes through `useApiLookup`, in a body (D98).
 */
export const PatientsClient = {
  create: ({ input, key }: { input: PatientInput; key: string }) =>
    postOnce<Patient>(apiRoutes.patients.list, input, key),
  update: ({ id, ...changes }: UpdatePatientInput & { id: string }) =>
    patchJson<Patient>(apiRoutes.patients.one(id), changes),
};

/** A patient's alerts (plan §10.4): adding one, and changing or turning one off. */
export const AlertsClient = {
  add: ({ patientId, ...alert }: AlertInput & { patientId: string }) =>
    postJson<PatientAlert>(apiRoutes.patients.alerts(patientId), alert),
  update: ({ patientId, alertId, ...changes }: UpdateAlertInput & { patientId: string; alertId: string }) =>
    patchJson<PatientAlert>(apiRoutes.patients.alert(patientId, alertId), changes),
};
