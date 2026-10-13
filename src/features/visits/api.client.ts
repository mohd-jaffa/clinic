import { patchJson, postJson, putJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { SaveVitalsInput, StartVisitInput, VisitChangeInput } from "@/lib/validation";

import type { VisitNotes, VisitStarted, VitalsSaved } from "./types";

/**
 * The visit's endpoints the browser calls (plan §30): each section saved
 * alone with what the screen had read of it (D202, D206); a waiting patient's
 * vitals (D203); New visit and its Done (D204).
 */
export const VisitsClient = {
  saveVitals: ({ id, input }: { id: string; input: SaveVitalsInput }) =>
    putJson<VitalsSaved>(apiRoutes.visits.vitals(id), input),
  saveWaitingVitals: ({ appointmentId, input }: { appointmentId: string; input: SaveVitalsInput }) =>
    putJson<VitalsSaved>(apiRoutes.appointments.vitals(appointmentId), input),
  change: ({ id, input }: { id: string; input: VisitChangeInput }) =>
    patchJson<Partial<VisitNotes & { followUpOn: string | null }>>(apiRoutes.visits.one(id), input),
  start: (input: StartVisitInput) => postJson<VisitStarted>(apiRoutes.visits.list, input),
  done: (id: string) => postJson<{ visitId: string }>(apiRoutes.visits.done(id)),
};
