import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_ROUTES, HOME_ROUTE } from "@/constants/routes";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/cookies";

const { renewSession } = vi.hoisted(() => ({ renewSession: vi.fn() }));
vi.mock("@/features/auth/renew", () => ({ renewSession }));

const { config, proxy } = await import("@/proxy");

beforeEach(() => {
  renewSession.mockReset();
  renewSession.mockResolvedValue(NextResponse.next());
});

/** A signed-in visit carries both cookies; `expired` leaves the access token's out, as the browser does once it runs out. */
function visit(path: string, { signedIn = false, expired = false } = {}) {
  const request = new NextRequest(new URL(path, "https://clinicdesk.test"));
  if (signedIn) {
    request.cookies.set(REFRESH_TOKEN_COOKIE, "refresh-token");
    if (!expired) request.cookies.set(ACCESS_TOKEN_COOKIE, "access-token");
  }
  return proxy(request);
}

function destinationOf(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
}

const pattern = new RegExp(`^${config.matcher[0]}$`);

describe("a signed-out visitor", () => {
  it("is sent to sign in, and told where they were going", async () => {
    expect(destinationOf(await visit("/patients?tab=OWING"))).toBe("/login?next=%2Fpatients%3Ftab%3DOWING");
  });

  it("reaches every screen that exists before a session does", async () => {
    for (const path of Object.values(AUTH_ROUTES)) {
      expect(destinationOf(await visit(path)), path).toBeNull();
    }
  });
});

describe("someone signed in", () => {
  it("goes about the app untouched", async () => {
    expect(destinationOf(await visit("/patients", { signedIn: true }))).toBeNull();
  });

  it("is sent on from sign-in, registration and forgot-password rather than shown them again", async () => {
    for (const path of [AUTH_ROUTES.signIn, AUTH_ROUTES.register, AUTH_ROUTES.forgotPassword]) {
      expect(destinationOf(await visit(path, { signedIn: true })), path).toBe(HOME_ROUTE);
    }
  });

  it("lands back where they were headed before signing in", async () => {
    expect(destinationOf(await visit("/login?next=%2Fappointments", { signedIn: true }))).toBe("/appointments");
  });

  it("is not carried off to another site by a crafted link", async () => {
    expect(destinationOf(await visit("/login?next=https%3A%2F%2Felsewhere.example", { signedIn: true }))).toBe(
      HOME_ROUTE,
    );
  });

  it("may still follow an email's link: confirm, reset a password, accept an invite", async () => {
    for (const path of [AUTH_ROUTES.confirmEmail, AUTH_ROUTES.resetPassword, AUTH_ROUTES.acceptInvite]) {
      expect(destinationOf(await visit(path, { signedIn: true })), path).toBeNull();
    }
  });
});

describe("someone signed in whose access token has run out", () => {
  it("has the session renewed before the screen is drawn, with its data", async () => {
    await visit("/patients", { signedIn: true, expired: true });
    expect(renewSession).toHaveBeenCalledWith(expect.any(NextRequest), "refresh-token");
  });

  it("is not renewed while the access token lasts, nor on a screen that needs no session", async () => {
    await visit("/patients", { signedIn: true });
    await visit(AUTH_ROUTES.confirmEmail, { signedIn: true, expired: true });
    expect(renewSession).not.toHaveBeenCalled();
  });
});

describe("what the proxy runs on", () => {
  it("leaves the API and Next's assets alone, and runs on the app's screens and the admin console", () => {
    for (const path of ["/api/patients", "/_next/static/chunk.js", "/_next/image", "/favicon.ico"]) {
      expect(pattern.test(path), path).toBe(false);
    }
    for (const path of ["/home", "/patients", "/admin", "/settings"]) expect(pattern.test(path), path).toBe(true);
  });

  it("leaves alone what the installed app needs signed in or not: its icons, worker, manifest and offline page", () => {
    for (const path of [
      "/icons/icon-512.png",
      "/icon.png",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/sw.js",
      "/offline",
    ]) {
      expect(pattern.test(path), path).toBe(false);
    }
  });

  it("leaves the landing page and the legal pages alone, for anyone to read, but not Home", () => {
    for (const path of ["/", "/privacy", "/terms", "/robots.txt", "/sitemap.xml"]) {
      expect(pattern.test(path), path).toBe(false);
    }
    expect(pattern.test("/home")).toBe(true);
  });
});
