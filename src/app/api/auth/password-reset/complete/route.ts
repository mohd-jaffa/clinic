import { completePasswordReset } from "@/features/auth/password";
import { withSessionRoute } from "@/features/auth/route";
import { readJson } from "@/lib/api/handler";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { passwordResetCompleteSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The reset link's new password (plan §5.3): set, and the person signed in. */
export async function POST(request: Request) {
  return withSessionRoute(request, async () =>
    completePasswordReset(
      createSupabaseAnonClient(),
      createSupabaseServiceRoleClient(),
      await readJson(request, passwordResetCompleteSchema),
    ),
  );
}
