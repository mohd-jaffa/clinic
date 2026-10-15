import type { TreatmentStatus } from "@/constants/statuses";
import { deleteJson, patchJson, postJson, putJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type {
  ChangeTreatmentInput,
  NewTreatmentInput,
  TreatmentSessionInput,
  TreatmentStatusInput,
} from "@/lib/validation";

import type { SessionSaved, TreatmentDetails } from "./types";

/** The treatments' endpoints the browser calls (plan §30; D250 – D259). */
export const TreatmentsClient = {
  create: (input: NewTreatmentInput) => postJson<{ id: string; name: string }>(apiRoutes.treatments.list, input),
  change: ({ id, input }: { id: string; input: ChangeTreatmentInput }) =>
    patchJson<Partial<TreatmentDetails>>(apiRoutes.treatments.one(id), input),
  setStatus: ({ id, input }: { id: string; input: TreatmentStatusInput }) =>
    postJson<{ status: TreatmentStatus }>(apiRoutes.treatments.status(id), input),
  recordSession: ({ id, visitId, input }: { id: string; visitId: string; input: TreatmentSessionInput }) =>
    putJson<SessionSaved>(apiRoutes.treatments.session(id, visitId), input),
  removeSession: ({ id, visitId }: { id: string; visitId: string }) =>
    deleteJson<{ treatmentId: string; visitId: string }>(apiRoutes.treatments.session(id, visitId)),
};
