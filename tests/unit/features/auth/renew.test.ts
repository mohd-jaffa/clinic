import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/cookies";
import { authenticationError, authorizationError, externalServiceError } from "@/lib/errors";

const { refreshSession } = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ refreshSession }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: () => "anon-client",
  createSupabaseServiceRoleClient: () => "service-client",
}));

const { renewSession } = await import("@/features/auth/renew");

function pageRequest(path = "/patients?tab=OWING") {
  const request = new NextRequest(new URL(path, "https://clinicdesk.test"));
  request.cookies.set(REFRESH_TOKEN_COOKIE, "refresh-old");
  request.cookies.set("app_theme", "dark");
  return request;
}

beforeEach(() => {
  refreshSession.mockReset();
});

describe("renewSession", () => {
  it("renews the session before the screen is drawn, and draws the screen with the new token", async () => {
    refreshSession.mockResolvedValue({ accessToken: "access-new", refreshToken: "refresh-new", expiresAt: null });

    const response = await renewSession(pageRequest(), "refresh-old");

    expect(refreshSession).toHaveBeenCalledWith("anon-client", "service-client", "refresh-old");
    // The browser keeps the new pair, as the refresh route would set it.
    const set = response.headers.getSetCookie();
    expect(set.find((cookie) => cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=access-new`))).toMatch(/HttpOnly/);
    expect(set.find((cookie) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=refresh-new`))).toBeDefined();
    // And the screen itself is asked for with it, the other cookies kept.
    const forwarded = response.headers.get("x-middleware-request-cookie") ?? "";
    expect(forwarded).toContain(`${ACCESS_TOKEN_COOKIE}=access-new`);
    expect(forwarded).toContain(`${REFRESH_TOKEN_COOKIE}=refresh-new`);
    expect(forwarded).toContain("app_theme=dark");
    expect(forwarded).not.toContain("refresh-old");
    expect(response.headers.get("location")).toBeNull();
  });

  it("renews a request that carries no other cookie", async () => {
    refreshSession.mockResolvedValue({ accessToken: "access-new", refreshToken: "refresh-new", expiresAt: null });

    const response = await renewSession(new NextRequest(new URL("/", "https://clinicdesk.test")), "refresh-old");

    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      `${ACCESS_TOKEN_COOKIE}=access-new; ${REFRESH_TOKEN_COOKIE}=refresh-new`,
    );
  });

  it("ends a session the server refuses to renew: the cookies are cleared and sign-in remembers the way back", async () => {
    refreshSession.mockImplementation(async () => {
      throw authenticationError("AUTH_SESSION_INVALID");
    });

    const response = await renewSession(pageRequest(), "refresh-old");

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname + location.search).toBe("/login?next=%2Fpatients%3Ftab%3DOWING");
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(`^${ACCESS_TOKEN_COOKIE}=; .*Max-Age=0`)),
        expect.stringMatching(new RegExp(`^${REFRESH_TOKEN_COOKIE}=; .*Max-Age=0`)),
      ]),
    );
  });

  it("also ends a session whose membership was deactivated", async () => {
    refreshSession.mockImplementation(async () => {
      throw authorizationError("AUTH_MEMBERSHIP_INACTIVE");
    });

    const response = await renewSession(pageRequest(), "refresh-old");

    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("lets the screen through when Supabase cannot be reached, for the browser to try again", async () => {
    refreshSession.mockImplementation(async () => {
      throw externalServiceError("EXTERNAL_SERVICE_ERROR");
    });

    const response = await renewSession(pageRequest(), "refresh-old");

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
