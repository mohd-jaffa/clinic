import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath, isSignedOutOnlyPath, returnToPath, RETURN_TO_PARAM, signInPath } from "@/constants/routes";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/cookies";
import { renewSession } from "@/features/auth/renew";

/**
 * Keeps signed-out visitors out of the app's screens, and signed-in people off
 * the sign-in screens (plan §5.5). It decides on the presence of the session
 * cookies alone — it never reads the token, because a proxy runs on every
 * request and is not where authorization belongs.
 *
 * One thing more: a screen asked for once the access token has run out (its
 * cookie expires with it) has the session renewed first (`renewSession`), so
 * the server can draw the screen signed in, with its data. That asks Supabase
 * at most once an hour.
 *
 * Nothing here is a security control. Whether a request may see a row is
 * settled by the route guard and by RLS (AGENTS.md §7, §9).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (isPublicPath(pathname)) {
    if (!refreshToken || !isSignedOutOnlyPath(pathname)) return NextResponse.next();
    const returnTo = returnToPath(request.nextUrl.searchParams.get(RETURN_TO_PARAM));
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  if (!refreshToken) return NextResponse.redirect(new URL(signInPath(`${pathname}${search}`), request.url));
  if (!request.cookies.has(ACCESS_TOKEN_COOKIE)) return renewSession(request, refreshToken);
  return NextResponse.next();
}

export const config = {
  /*
   * Everything but what anyone may reach signed in or not: the API (which
   * answers 401 itself and is called by more than browsers), Next's own
   * assets, the landing page at the root, the legal pages, and what the
   * installed app needs before signing in — its manifest, icons, service
   * worker and offline page (plan §21).
   */
  matcher: [
    "/((?!$|api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|icons/|offline|privacy|terms|robots.txt|sitemap.xml).*)",
  ],
};
