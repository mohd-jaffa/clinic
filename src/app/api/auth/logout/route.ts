import { readAccessTokenCookie } from "@/features/auth/cookies";
import { bearerToken } from "@/features/auth/guard";
import { withSignOutRoute } from "@/features/auth/route";
import { logout } from "@/features/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withSignOutRoute(request, async () => {
    const accessToken = bearerToken(request.headers) ?? readAccessTokenCookie(request.headers);
    // No token means there is nothing to revoke; the cookies are cleared either way.
    if (!accessToken) return { signedOut: true };
    return logout(createSupabaseServiceRoleClient(), accessToken);
  });
}
