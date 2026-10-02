import { resendConfirmation } from "@/features/auth/register";
import { readJson, withApiHandler } from "@/lib/api/handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { emailRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The confirm screen's Resend (plan §5.1). */
export async function POST(request: Request) {
  return withApiHandler(request, async () =>
    resendConfirmation(createSupabaseServiceRoleClient(), await readJson(request, emailRequestSchema)),
  );
}
