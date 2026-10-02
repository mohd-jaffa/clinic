import { register } from "@/features/auth/register";
import { readJson, withApiHandler } from "@/lib/api/handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Sign-up (plan §5.1): the owner and their clinic. No session: the email is confirmed first. */
export async function POST(request: Request) {
  return withApiHandler(
    request,
    async () => register(createSupabaseServiceRoleClient(), await readJson(request, registerSchema)),
    { successStatus: 201 },
  );
}
