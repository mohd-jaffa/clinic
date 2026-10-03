import { withClinicRoute } from "@/features/auth/guard";
import { revokeInvite } from "@/features/team/invites";
import type { RouteParams } from "@/lib/api/params";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Revokes an open invite (plan §8.4), for `team.manage`. */
export async function DELETE(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "team.manage" }, async (context) =>
    revokeInvite(context, createSupabaseServiceRoleClient(), (await params).id, context.requestId),
  );
}
