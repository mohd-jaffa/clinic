import { requestPasswordReset } from "@/features/auth/password";
import { readJson, withApiHandler } from "@/lib/api/handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { emailRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Forgot password (plan §5.3): a reset link, if the address has an account; the same answer either way. */
export async function POST(request: Request) {
  return withApiHandler(request, async () =>
    requestPasswordReset(createSupabaseServiceRoleClient(), await readJson(request, emailRequestSchema)),
  );
}
