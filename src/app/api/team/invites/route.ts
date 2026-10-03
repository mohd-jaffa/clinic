import { withClinicRoute } from "@/features/auth/guard";
import { inviteMember } from "@/features/team/invites";
import { readJson } from "@/lib/api/handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { inviteSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Invites a doctor or a member of staff by email (plan §8.4, D89), for `team.manage`. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "team.manage", successStatus: 201 }, async (context) =>
    inviteMember(context, createSupabaseServiceRoleClient(), await readJson(request, inviteSchema), context.requestId),
  );
}
