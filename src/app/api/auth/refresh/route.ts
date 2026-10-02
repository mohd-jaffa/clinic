import { readRefreshTokenCookie } from "@/features/auth/cookies";
import { withSessionRoute } from "@/features/auth/route";
import { refreshSession } from "@/features/auth/session";
import { authenticationError } from "@/lib/errors";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Trades the refresh cookie for a fresh access token (plan §5.5). The browser
 * calls it when a request is refused for an expired token, so an hour of work
 * does not end at a sign-in screen.
 */
export async function POST(request: Request) {
  return withSessionRoute(request, async () => {
    const refreshToken = readRefreshTokenCookie(request.headers);
    if (!refreshToken) throw authenticationError("AUTH_SESSION_REQUIRED");
    return refreshSession(createSupabaseAnonClient(), createSupabaseServiceRoleClient(), refreshToken);
  });
}
