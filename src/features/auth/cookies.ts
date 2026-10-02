import type { AuthenticatedSession } from "./types";

/**
 * Where the session lives between requests (plan §5, AGENTS.md §9). The tokens
 * are kept in HttpOnly cookies rather than in `localStorage`, so no script in
 * the page can read them and no screen has to remember to attach them — the
 * browser sends them with every same-origin request on its own. This module is
 * the only place that names, builds or reads them.
 *
 * SameSite=Lax is what stops another site posting to these endpoints with the
 * cookies attached; Secure is set outside development so the pair is never
 * sent over plain HTTP.
 */
export const ACCESS_TOKEN_COOKIE = "app_access_token";
export const REFRESH_TOKEN_COOKIE = "app_refresh_token";

/**
 * Sessions last until sign-out (D56): the refresh cookie is kept as long as a
 * browser keeps any cookie — 400 days — and every refresh sets it again.
 */
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
/** Used when Supabase does not say when the access token expires. */
export const ACCESS_TOKEN_FALLBACK_MAX_AGE_SECONDS = 60 * 60;

export interface SessionCookie {
  name: string;
  value: string;
  maxAge: number;
}

/** Seconds of life left in an access token, never negative. */
function accessTokenMaxAge(expiresAt: number | null, nowMs: number): number {
  if (expiresAt == null) return ACCESS_TOKEN_FALLBACK_MAX_AGE_SECONDS;
  return Math.max(0, Math.floor(expiresAt - nowMs / 1000));
}

/**
 * The cookies that carry a session. The access cookie is given the token's own
 * remaining life, so an expired token is dropped by the browser rather than
 * sent and refused; the refresh cookie outlives it, which is what lets the app
 * quietly get a new access token instead of asking for the password again.
 */
export function sessionCookies(
  session: Pick<AuthenticatedSession, "accessToken" | "refreshToken" | "expiresAt">,
  nowMs: number = Date.now(),
): SessionCookie[] {
  return [
    { name: ACCESS_TOKEN_COOKIE, value: session.accessToken, maxAge: accessTokenMaxAge(session.expiresAt, nowMs) },
    { name: REFRESH_TOKEN_COOKIE, value: session.refreshToken, maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS },
  ];
}

/** The same two cookies, emptied and expired — what signing out sends back. */
export function clearedSessionCookies(): SessionCookie[] {
  return [
    { name: ACCESS_TOKEN_COOKIE, value: "", maxAge: 0 },
    { name: REFRESH_TOKEN_COOKIE, value: "", maxAge: 0 },
  ];
}

export function serializeSessionCookie(cookie: SessionCookie, secure: boolean): string {
  return [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${cookie.maxAge}`,
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/** One cookie's value out of a request's `Cookie` header, or null. */
export function readCookie(headers: Headers, name: string): string | null {
  const header = headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    const value = part.slice(separator + 1).trim();
    return value === "" ? null : decodeURIComponent(value);
  }

  return null;
}

export function readAccessTokenCookie(headers: Headers): string | null {
  return readCookie(headers, ACCESS_TOKEN_COOKIE);
}

export function readRefreshTokenCookie(headers: Headers): string | null {
  return readCookie(headers, REFRESH_TOKEN_COOKIE);
}

/** Attaches a set of session cookies to a response the handler already built. */
export function withSessionCookies<T extends Response>(
  response: T,
  cookies: SessionCookie[],
  secure: boolean = process.env.NODE_ENV === "production",
): T {
  for (const cookie of cookies) {
    response.headers.append("set-cookie", serializeSessionCookie(cookie, secure));
  }
  return response;
}
