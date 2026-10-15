import type { FollowUpTab } from "@/constants/statuses";
import { apiRoutes, withQuery } from "@/lib/query/keys";

/**
 * What a treatment's change makes stale (D256, D260, D262): the patient's
 * summary, which holds their treatments; their history, whose visits name
 * the treatments worked on; and the visit it was changed from, if any.
 */
export function treatmentRoutes(patientId: string, visitId: string | null): string[] {
  return [
    apiRoutes.patients.summary(patientId),
    apiRoutes.patients.timeline(patientId),
    ...(visitId === null ? [] : [apiRoutes.visits.one(visitId)]),
  ];
}

/** A tab of the follow-ups (plan §14.3): the page's first read and the screen's hook ask for the very same thing. */
export const followUpsKey = (tab: FollowUpTab) => withQuery(apiRoutes.followUps.list, { tab });

/** What a contact noted, or a booking made from a follow-up, makes stale: every tab, and how many each holds. */
export const FOLLOW_UP_ROUTES = [apiRoutes.followUps.list, apiRoutes.followUps.counts];
