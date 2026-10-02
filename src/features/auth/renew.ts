import { NextResponse, type NextRequest } from "next/server";

import { signInPath } from "@/constants/routes";
import { AppError } from "@/lib/errors";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

import { clearedSessionCookies, sessionCookies, withSessionCookies, type SessionCookie } from "./cookies";
import { refreshSession } from "./session";

/** The request's `Cookie` header with these cookies set to their new values. */
function withCookies(header: string | null, cookies: SessionCookie[]): string {
  const names = new Set(cookies.map((cookie) => cookie.name));
  const kept = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part !== "" && !names.has(part.slice(0, part.indexOf("=")).trim()));
  return [...kept, ...cookies.map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)].join("; ");
}

/**
 * A screen asked for with only the refresh cookie left — the access token ran
 * out, and its cookie with it: the usual state of an app opened after an hour
 * away. The session is renewed here, before the screen is drawn (plan §5.5),
 * so the server draws it signed in, with its data. The new cookies go back
 * with the screen, and the screen itself is drawn with the new token.
 *
 * - A refresh the server refuses means the session is over: the cookies are
 *   cleared and the visitor is sent to sign in, remembering where they were.
 * - Anything else — Supabase out of reach — lets the screen through, and the
 *   browser tries again.
 */
export async function renewSession(request: NextRequest, refreshToken: string): Promise<NextResponse> {
  try {
    const session = await refreshSession(createSupabaseAnonClient(), createSupabaseServiceRoleClient(), refreshToken);
    const cookies = sessionCookies(session);
    const headers = new Headers(request.headers);
    headers.set("cookie", withCookies(request.headers.get("cookie"), cookies));
    return withSessionCookies(NextResponse.next({ request: { headers } }), cookies);
  } catch (error) {
    if (error instanceof AppError && (error.kind === "AUTHENTICATION" || error.kind === "AUTHORIZATION")) {
      const { pathname, search } = request.nextUrl;
      return withSessionCookies(
        NextResponse.redirect(new URL(signInPath(`${pathname}${search}`), request.url)),
        clearedSessionCookies(),
      );
    }
    return NextResponse.next();
  }
}
