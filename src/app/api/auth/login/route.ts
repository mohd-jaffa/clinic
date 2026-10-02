import { login } from "@/features/auth/session";
import { withSessionRoute } from "@/features/auth/route";
import { readJson } from "@/lib/api/handler";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Sign in with an email or a mobile number and the password (plan §5.2). */
export async function POST(request: Request) {
  return withSessionRoute(request, async () =>
    login(createSupabaseAnonClient(), createSupabaseServiceRoleClient(), await readJson(request, loginSchema)),
  );
}
