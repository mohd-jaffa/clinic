import type { SupabaseClient } from "@supabase/supabase-js";

import { ROUTE_ACCESS, type RouteAccess } from "@/constants/permissions";
import { withApiHandler, type ApiContext } from "@/lib/api/handler";
import { authenticationError, authorizationError, businessRuleError } from "@/lib/errors";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/supabase/tenant";

import { readAccessTokenCookie } from "./cookies";
import { getSession } from "./session";
import type { AuthenticatedSession, SessionMembership } from "./types";

/** The token in an `Authorization: Bearer` header, or null when there is none. */
export function bearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}

/**
 * The access token behind a request. The browser sends it as an HttpOnly
 * cookie; a script, a test or a native client may send it as a bearer header
 * instead. Both are accepted here so no route has to know which it is looking
 * at, and a request carrying neither is refused before it reaches any data.
 */
export function readAccessToken(request: Request): string {
  const token = bearerToken(request.headers) ?? readAccessTokenCookie(request.headers);
  if (!token) throw authenticationError("AUTH_SESSION_REQUIRED");
  return token;
}

/** The session behind a request: refused when there is none, or it is no longer good. */
export function requireSession(request: Request): Promise<AuthenticatedSession> {
  return getSession(createSupabaseServiceRoleClient(), readAccessToken(request));
}

/** Who is asking, for the error log should the request fail. */
function askerOf(session: AuthenticatedSession): NonNullable<ApiContext["asker"]> {
  return { userId: session.profile.id, clinicId: session.membership?.clinicId ?? null };
}

/** A method that changes something: what read-only refuses (plan §7.3). */
export function isWrite(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

/**
 * Whether the member may do what the route does (plan §8): any member, the
 * owner alone, or a named permission — the owner holding every one. There is
 * no default: a route always says which (AGENTS.md §8).
 */
export function hasAccess(membership: SessionMembership, access: RouteAccess): boolean {
  if (access === ROUTE_ACCESS.member) return true;
  if (access === ROUTE_ACCESS.owner) return membership.role === "OWNER";
  return membership.permissions.includes(access);
}

/** What a clinic route is handed: who is asking, and a client that can only see their clinic. */
export interface ClinicContext extends ApiContext, Tenant {
  session: AuthenticatedSession;
}

export interface ClinicRouteOptions {
  /** Who the route serves: a permission, any member, or the owner (plan §31.2). */
  access: RouteAccess;
  successStatus?: number;
  /**
   * A write a read-only clinic may still make (plan §7.2): deleting the clinic,
   * requesting its deletion. Everything else that writes is refused.
   */
  allowReadOnly?: boolean;
}

/**
 * A route that acts on one clinic's data (plan §27.1, AGENTS.md §7). It
 * resolves the session and the active membership, refuses a missing
 * permission (AUTH_PERMISSION_DENIED) and a write while the clinic is
 * view-only (CLINIC_PLAN_EXPIRED), and builds the `Tenant` — whose client
 * carries the caller's token, so RLS checks it all again. The platform admin,
 * who belongs to no clinic, is refused.
 */
export function withClinicRoute<TData>(
  request: Request,
  options: ClinicRouteOptions,
  handler: (context: ClinicContext) => Promise<TData>,
) {
  return withApiHandler(
    request,
    async (api) => {
      const session = await requireSession(request);
      api.asker = askerOf(session);

      const { membership, subscription } = session;
      if (!membership || !subscription || !hasAccess(membership, options.access)) throw authorizationError();
      if (isWrite(request.method) && !options.allowReadOnly && subscription.state === "READ_ONLY") {
        throw businessRuleError("CLINIC_PLAN_EXPIRED");
      }

      return handler({
        ...api,
        session,
        supabase: createSupabaseAnonClient(session.accessToken),
        clinicId: membership.clinicId,
        actorId: session.profile.id,
        memberId: membership.id,
        role: membership.role,
        permissions: membership.permissions,
        doctorId: membership.doctorId,
      });
    },
    { successStatus: options.successStatus },
  );
}

/**
 * What an account route is handed: the session, the caller's own client, and
 * the server's — Auth and profiles are written by the server only (0002).
 */
export interface AccountContext extends ApiContext {
  session: AuthenticatedSession;
  supabase: SupabaseClient;
  admin: SupabaseClient;
}

/**
 * A route that changes the signed-in person's own account — their name,
 * mobile, password (plan §5.4) — whoever they are, the platform admin
 * included. A member's write is refused while their clinic is view-only,
 * unless the route allows it (changing one's own password, plan §7.2).
 */
export function withAccountRoute<TData>(
  request: Request,
  options: { allowReadOnly?: boolean },
  handler: (context: AccountContext) => Promise<TData>,
) {
  return withApiHandler(request, async (api) => {
    const session = await requireSession(request);
    api.asker = askerOf(session);
    if (isWrite(request.method) && !options.allowReadOnly && session.subscription?.state === "READ_ONLY") {
      throw businessRuleError("CLINIC_PLAN_EXPIRED");
    }
    return handler({
      ...api,
      session,
      supabase: createSupabaseAnonClient(session.accessToken),
      admin: createSupabaseServiceRoleClient(),
    });
  });
}

/**
 * What a developer console route is handed: the session; the server's client,
 * to read across clinics; and the DEV's own, for the functions that check the
 * role themselves (update_platform_settings, extend_clinic_subscription).
 */
export interface DeveloperContext extends ApiContext {
  session: AuthenticatedSession;
  supabase: SupabaseClient;
  admin: SupabaseClient;
}

/**
 * A route of the developer console (plan §20): DEV and only DEV. Every read
 * there is a fixed query of `src/features/admin` that shows no clinic data;
 * every write goes through a function that checks the role again.
 */
export function withDevRoute<TData>(request: Request, handler: (context: DeveloperContext) => Promise<TData>) {
  return withApiHandler(request, async (api) => {
    const session = await requireSession(request);
    api.asker = askerOf(session);
    if (session.profile.platformRole !== "DEV") throw authorizationError();
    return handler({
      ...api,
      session,
      supabase: createSupabaseAnonClient(session.accessToken),
      admin: createSupabaseServiceRoleClient(),
    });
  });
}
