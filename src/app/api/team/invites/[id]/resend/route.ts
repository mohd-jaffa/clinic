import { withClinicRoute } from "@/features/auth/guard";
import { resendInvite } from "@/features/team/invites";
import type { RouteParams } from "@/lib/api/params";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Sends an open invite again, with a new link (plan §8.4), for `team.manage`. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "team.manage" }, async (context) =>
    resendInvite(context, createSupabaseServiceRoleClient(), (await params).id, context.requestId),
  );
}
