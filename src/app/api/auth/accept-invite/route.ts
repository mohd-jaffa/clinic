import { withSessionRoute } from "@/features/auth/route";
import { acceptInvite } from "@/features/team/accept";
import { readJson } from "@/lib/api/handler";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { acceptInviteSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Accepting an invite (plan §8.5, D92): the person joins, and this device is signed in as them. */
export async function POST(request: Request) {
  return withSessionRoute(request, async (context) =>
    acceptInvite(
      createSupabaseAnonClient(),
      createSupabaseServiceRoleClient(),
      await readJson(request, acceptInviteSchema),
      context.requestId,
    ),
  );
}
