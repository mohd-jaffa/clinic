import { patchJson, postJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { AlertInput, ImportRowInput, PatientInput, UpdateAlertInput, UpdatePatientInput } from "@/lib/validation";

import type { ImportMatch, ImportResult, Patient, PatientAlert } from "./types";

/**
 * The patients' endpoints the browser calls (plan §30): adding one — once per
 * key, however often it is sent — changing one, and archiving and restoring
 * one (D103). What is looked up about
 * a patient goes through `useApiLookup`, in a body (D98).
 */
export const PatientsClient = {
  create: ({ input, key }: { input: PatientInput; key: string }) =>
    postOnce<Patient>(apiRoutes.patients.list, input, key),
  update: ({ id, ...changes }: UpdatePatientInput & { id: string }) =>
    patchJson<Patient>(apiRoutes.patients.one(id), changes),
  archive: (id: string) => postJson<Patient>(apiRoutes.patients.archive(id)),
  restore: (id: string) => postJson<Patient>(apiRoutes.patients.restore(id)),
};

/** A patient's alerts (plan §10.4): adding one, and changing or turning one off. */
export const AlertsClient = {
  add: ({ patientId, ...alert }: AlertInput & { patientId: string }) =>
    postJson<PatientAlert>(apiRoutes.patients.alerts(patientId), alert),
  update: ({ patientId, alertId, ...changes }: UpdateAlertInput & { patientId: string; alertId: string }) =>
    patchJson<PatientAlert>(apiRoutes.patients.alert(patientId, alertId), changes),
};

/**
 * A patient import (plan §10.5): the clinic's patients on a batch of the
 * file's mobiles, and a batch of its checked rows — each under its own key,
 * so sending one again adds no one twice.
 */
export const ImportClient = {
  matches: (phones: readonly string[]) => postJson<ImportMatch[]>(apiRoutes.patients.importMatches, { phones }),
  send: (rows: readonly ImportRowInput[]) => postJson<ImportResult>(apiRoutes.patients.import, { rows }),
};
