import { putJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { SavePrescriptionInput } from "@/lib/validation";

import type { PrescriptionSaved } from "./types";

/** The prescription's endpoint the browser calls (plan §30): saved whole, with what the screen had read of it (D210, D206). */
export const PrescriptionsClient = {
  save: ({ visitId, input }: { visitId: string; input: SavePrescriptionInput }) =>
    putJson<PrescriptionSaved>(apiRoutes.visits.prescription(visitId), input),
};
