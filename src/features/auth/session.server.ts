import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { hasAccess, ROUTE_ACCESS, type RouteAccess } from "@/constants/permissions";
import { ADMIN_ROUTE } from "@/constants/routes";
import { logger } from "@/lib/logger";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/supabase/tenant";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./cookies";
import { getSession, toSessionView } from "./session";
import type { AuthenticatedSession, AuthSessionView } from "./types";

/**
 * The session behind the request being drawn (ported from Brio), read once
 * however many parts of the page ask — the layout for who is signed in, the
 * page for its first data — and forgotten when the request ends:
 *
 * - **null** — signed out: no session cookie at all.
 * - **the session** — its access token is good.
 * - **undefined** — not settled here: the token was refused, or there is only
 *   a refresh cookie the proxy could not use. The browser settles it.
 *
 * Like the proxy, this decides nothing about access; the API and RLS do.
 */
const readServerSession = cache(async (): Promise<AuthenticatedSession | null | undefined> => {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return jar.has(REFRESH_TOKEN_COOKIE) ? undefined : null;

  try {
    return await getSession(createSupabaseServiceRoleClient(), accessToken);
  } catch {
    return undefined;
  }
});

/**
 * What the page arrives knowing of the session, for `AuthProvider`: the part
 * the browser may see — never a token — null for signed out, or undefined
 * when only the browser can settle it.
 */
export async function readInitialSession(): Promise<AuthSessionView | null | undefined> {
  const session = await readServerSession();
  return session ? toSessionView(session) : session;
}

/** A read of one screen's first data, made as its API route would make it. */
export type ScreenRead = (tenant: Tenant) => Promise<unknown>;

/** The first data a screen shows, keyed as its hooks ask for it (`ServerData`). */
export interface ScreenData {
  queries: Record<string, unknown>;
  pages: Record<string, unknown>;
}

const NOTHING: ScreenData = { queries: {}, pages: {} };

/**
 * A screen's first data, read on the server as the page is drawn, so it
 * arrives with the page instead of after it (AGENTS.md §9): each read is the
 * one its API route makes, for the same clinic, under the same RLS, and comes
 * back in the shape the route would have sent (JSON), keyed by the route the
 * screen's hook asks for.
 *
 * - The platform admin is sent to the developer console: they belong to no
 *   clinic and have nothing of one to show (plan §3.2).
 * - Anyone the screen's routes would refuse — no membership, or not the
 *   screen's `access` (plan §31.2) — gets nothing read, and the screen asks
 *   for itself, so the API gives the answer.
 * - A read that fails is left out and logged, by route alone; its screen asks
 *   for it, and shows its own error if it fails again.
 *
 * `queries` feed `useApiQuery`; `pages` feed the first page of `useApiPages`.
 */
export async function readScreen(reads: {
  /** Who the screen is for; any member unless it says (plan §31.2). */
  access?: RouteAccess;
  queries?: Record<string, ScreenRead>;
  pages?: Record<string, ScreenRead>;
}): Promise<ScreenData> {
  const session = await readServerSession();
  if (!session) return NOTHING;
  if (session.profile.platformRole === "DEV") redirect(ADMIN_ROUTE);
  const { membership } = session;
  if (!membership || !hasAccess(membership, reads.access ?? ROUTE_ACCESS.member)) return NOTHING;

  const tenant: Tenant = {
    supabase: createSupabaseAnonClient(session.accessToken),
    clinicId: membership.clinicId,
    actorId: session.profile.id,
    memberId: membership.id,
    role: membership.role,
    permissions: membership.permissions,
    doctorId: membership.doctorId,
  };

  const readAll = async (group: Record<string, ScreenRead> = {}) => {
    const entries = await Promise.all(
      Object.entries(group).map(async ([key, read]) => {
        try {
          // Exactly what the route would have sent: dates as strings, nothing undefined.
          return [key, JSON.parse(JSON.stringify(await read(tenant)))] as const;
        } catch (failure) {
          logger.warn("A screen's first data was not read on the server; the browser will ask", {
            route: key,
            reason: failure instanceof Error ? failure.name : "unknown",
          });
          return null;
        }
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== null));
  };

  const [queries, pages] = await Promise.all([readAll(reads.queries), readAll(reads.pages)]);
  return { queries, pages };
}
