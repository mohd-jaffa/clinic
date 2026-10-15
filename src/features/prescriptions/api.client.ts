import { patchJson, postJson, putJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { ChangeTemplateInput, SavePrescriptionInput, SaveTemplateInput } from "@/lib/validation";

import type { PrescriptionSaved, PrescriptionTemplate } from "./types";

/** The prescription's endpoint the browser calls (plan §30): saved whole, with what the screen had read of it (D210, D206). */
export const PrescriptionsClient = {
  save: ({ visitId, input }: { visitId: string; input: SavePrescriptionInput }) =>
    putJson<PrescriptionSaved>(apiRoutes.visits.prescription(visitId), input),
};

/** A doctor's templates' endpoints (D240 – D243): a new one, or one changed, archived or restored. */
export const TemplatesClient = {
  add: (input: SaveTemplateInput) => postJson<PrescriptionTemplate>(apiRoutes.prescriptionTemplates.list, input),
  change: ({ id, input }: { id: string; input: ChangeTemplateInput }) =>
    patchJson<PrescriptionTemplate>(apiRoutes.prescriptionTemplates.one(id), input),
};
