import { previewInvite } from "@/features/team/accept";
import { readJson, withApiHandler } from "@/lib/api/handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { invitePreviewSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * What an invite's link opens onto (plan §8.5): the clinic, the role and the
 * person, before anyone has signed in. The token travels in the body, never
 * in an address.
 */
export async function POST(request: Request) {
  return withApiHandler(request, async () =>
    previewInvite(createSupabaseServiceRoleClient(), await readJson(request, invitePreviewSchema)),
  );
}
