/**
 * The screens that exist before anyone has signed in, and the rules about who
 * may go where (plan §31). Kept apart from the navigation (with its icons),
 * because the proxy reads this on every request.
 */
export const AUTH_ROUTES = {
  signIn: "/login",
  register: "/register",
  confirmEmail: "/confirm-email",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  acceptInvite: "/accept-invite",
} as const;

/** Where a signed-in member lands when they have nowhere particular to go. */
export const HOME_ROUTE = "/home";

/** Where the platform admin (DEV) lands instead: they belong to no clinic (plan §20). */
export const ADMIN_ROUTE = "/admin";

/** Open to anyone, signed in or not (plan §21); the proxy does not run for them. */
export const LANDING_ROUTE = "/";
export const PRIVACY_ROUTE = "/privacy";
export const TERMS_ROUTE = "/terms";

/** Carries the screen someone was heading for through the sign-in detour. */
export const RETURN_TO_PARAM = "next";

/** The account screens: reachable without a session. */
const PUBLIC_PATHS: readonly string[] = Object.values(AUTH_ROUTES);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

/** The sign-in URL, remembering where the visitor was heading. */
export function signInPath(returnTo?: string | null): string {
  if (!returnTo || returnTo === HOME_ROUTE) return AUTH_ROUTES.signIn;
  return `${AUTH_ROUTES.signIn}?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`;
}

/**
 * Where to go after signing in. Only a path within the app is accepted: a
 * `next` of `https://elsewhere.example` or `//elsewhere.example` would
 * otherwise turn sign-in into an open redirect.
 */
export function returnToPath(returnTo: string | null | undefined): string {
  if (!returnTo) return HOME_ROUTE;
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return HOME_ROUTE;
  if (isPublicPath(returnTo.split("?")[0])) return HOME_ROUTE;
  return returnTo;
}
