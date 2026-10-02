import { withSessionRoute } from "@/features/auth/route";
import { confirmEmail } from "@/features/auth/session";
import { readJson } from "@/lib/api/handler";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { confirmEmailSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The confirmation link's landing (plan §5.1): the address is confirmed, and the owner signed in. */
export async function POST(request: Request) {
  return withSessionRoute(request, async () =>
    confirmEmail(
      createSupabaseAnonClient(),
      createSupabaseServiceRoleClient(),
      await readJson(request, confirmEmailSchema),
    ),
  );
}
