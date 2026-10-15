import { FOLLOW_UP_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { recordFollowUpContact } from "@/features/treatments/records";
import { readJson } from "@/lib/api/handler";
import { followUpContactSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A contact noted about a follow-up (plan §14.3; D271, D273), for
 * `appointments.edit` or `visits.edit` (D267): a call's outcome, a note and a
 * day to be reminded on — or a reminder sent on WhatsApp.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: FOLLOW_UP_ACCESS.note, successStatus: 201 }, async (context) =>
    recordFollowUpContact(context, await readJson(request, followUpContactSchema), context.requestId),
  );
}
