import { requireSession } from "@/features/auth/guard";
import { changePassword } from "@/features/auth/password";
import { withSessionRoute } from "@/features/auth/route";
import { readJson } from "@/lib/api/handler";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * My account's Change password (plan §5.4). Allowed in a read-only clinic
 * (plan §7.2). It answers with a fresh session, since setting a password ends
 * the old ones.
 */
export async function POST(request: Request) {
  return withSessionRoute(request, async (api) => {
    const session = await requireSession(request);
    api.asker = { userId: session.profile.id, clinicId: session.membership?.clinicId ?? null };
    return changePassword(
      createSupabaseAnonClient(),
      createSupabaseServiceRoleClient(),
      session,
      await readJson(request, changePasswordSchema),
    );
  });
}
