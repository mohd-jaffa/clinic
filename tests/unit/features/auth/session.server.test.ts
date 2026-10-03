import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/cookies";
import type { AuthenticatedSession } from "@/features/auth/types";
import { aDeveloperSession, aSession } from "@tests/support/auth";

const { jar, getSession, redirect, warn } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  getSession: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
  warn: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    has: (name: string) => jar.has(name),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => "service-client",
  createSupabaseAnonClient: (token: string) => `client-for-${token}`,
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/logger", () => ({ logger: { warn } }));
// Outside a server render, React's cache is a plain call: each read asks afresh.
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: (fn: unknown) => fn }));
vi.mock("@/features/auth/session", async (original) => ({
  ...(await original<typeof import("@/features/auth/session")>()),
  getSession,
}));

const { readInitialSession, readScreen } = await import("@/features/auth/session.server");

beforeEach(() => {
  jar.clear();
  getSession.mockReset();
  redirect.mockClear();
  warn.mockClear();
});

function signedIn(session: AuthenticatedSession = aSession()) {
  jar.set(ACCESS_TOKEN_COOKIE, "access-1");
  getSession.mockResolvedValue({ ...session, accessToken: "access-1", refreshToken: "" });
}

describe("readInitialSession", () => {
  it("knows a visitor with no session cookie is signed out, and asks nobody", async () => {
    expect(await readInitialSession()).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("hands over the session its access token proves, and never the token", async () => {
    signedIn();
    jar.set(REFRESH_TOKEN_COOKIE, "refresh-1");

    const view = await readInitialSession();

    expect(getSession).toHaveBeenCalledWith("service-client", "access-1");
    const { profile, membership, subscription } = aSession();
    expect(view).toEqual({ profile, membership, subscription });
    expect(JSON.stringify(view)).not.toContain("access-1");
  });

  it("leaves an expired access token to the browser, which can refresh it", async () => {
    jar.set(REFRESH_TOKEN_COOKIE, "refresh-1");
    expect(await readInitialSession()).toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("leaves a refused token to the browser too, rather than failing the page", async () => {
    jar.set(ACCESS_TOKEN_COOKIE, "stale");
    getSession.mockRejectedValue(new Error("AUTH_SESSION_INVALID"));
    expect(await readInitialSession()).toBeUndefined();
  });
});

describe("readScreen", () => {
  it("reads a screen's first data as its routes would, for the member's clinic, in the shape they send", async () => {
    const session = aSession();
    signedIn({ ...session, membership: { ...session.membership!, permissions: ["patients.view"] } });
    const listPatients = vi.fn(async () => ({
      items: [{ id: "p-1", createdAt: new Date("2026-10-02T05:00:00Z"), note: undefined }],
      nextCursor: null,
    }));

    const data = await readScreen({
      access: "patients.view",
      queries: { "/api/clinic": async () => ({ name: "Smile Care" }) },
      pages: { "/api/patients": listPatients },
    });

    expect(listPatients).toHaveBeenCalledWith({
      supabase: "client-for-access-1",
      clinicId: "clinic-1",
      actorId: "user-1",
      memberId: "member-1",
      role: "OWNER",
      permissions: ["patients.view"],
      doctorId: "doctor-1",
    });
    expect(data.queries).toEqual({ "/api/clinic": { name: "Smile Care" } });
    // As JSON: the date a string, nothing undefined.
    expect(data.pages["/api/patients"]).toEqual({
      items: [{ id: "p-1", createdAt: "2026-10-02T05:00:00.000Z" }],
      nextCursor: null,
    });
  });

  it("leaves out a read that fails, for the screen to ask for itself, and logs it by route alone", async () => {
    signedIn();
    const data = await readScreen({
      queries: {
        "/api/dashboard": async () => {
          throw new TypeError("offline");
        },
        "/api/clinic": async () => ({ name: "Smile Care" }),
      },
    });
    expect(Object.keys(data.queries)).toEqual(["/api/clinic"]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { route: "/api/dashboard", reason: "TypeError" });

    await readScreen({
      queries: {
        "/api/dashboard": async () => {
          throw "not an error";
        },
      },
    });
    expect(warn).toHaveBeenLastCalledWith(expect.any(String), { route: "/api/dashboard", reason: "unknown" });
  });

  it("reads nothing without a session, and nothing for someone the screen is not for", async () => {
    const read = vi.fn();
    expect(await readScreen({ queries: { "/api/patients": read } })).toEqual({ queries: {}, pages: {} });

    const session = aSession();
    signedIn({ ...session, membership: { ...session.membership!, role: "STAFF", permissions: ["expenses.view"] } });
    expect(await readScreen({ access: "patients.view", queries: { "/api/patients": read } })).toEqual({
      queries: {},
      pages: {},
      // Told so in the screen's place (NoAccess).
      refused: true,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("reads nothing for an account with no clinic", async () => {
    const read = vi.fn();
    signedIn(aSession({ membership: null, subscription: null }));
    expect(await readScreen({ queries: { "/api/patients": read } })).toEqual({ queries: {}, pages: {} });
    expect(read).not.toHaveBeenCalled();
  });

  it("sends the platform admin to the developer console: they have no clinic to show (plan §3.2)", async () => {
    const read = vi.fn();
    signedIn(aDeveloperSession());
    await expect(readScreen({ queries: { "/api/patients": read } })).rejects.toThrow("NEXT_REDIRECT /admin");
    expect(read).not.toHaveBeenCalled();
  });
});
