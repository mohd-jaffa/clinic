import { patchJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { PatientInput, UpdatePatientInput } from "@/lib/validation";

import type { Patient } from "./types";

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
