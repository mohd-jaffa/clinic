import { describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_FALLBACK_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  clearedSessionCookies,
  readAccessTokenCookie,
  readCookie,
  readRefreshTokenCookie,
  serializeSessionCookie,
  sessionCookies,
  withSessionCookies,
} from "@/features/auth/cookies";

const NOW = 1_800_000_000_000; // ms
const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: NOW / 1000 + 900,
};

function headersWith(cookie: string) {
  return new Headers({ cookie });
}

describe("session cookies", () => {
  it("gives the access cookie the token's own remaining life", () => {
    const [access] = sessionCookies(session, NOW);

    expect(access).toMatchObject({ name: ACCESS_TOKEN_COOKIE, value: "access-token", maxAge: 900 });
  });

  it("outlives the access token with the refresh cookie, kept until sign-out (D56)", () => {
    const [, refresh] = sessionCookies(session, NOW);

    expect(refresh).toMatchObject({
      name: REFRESH_TOKEN_COOKIE,
      value: "refresh-token",
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    });
  });

  it("never asks the browser to keep an already-expired token", () => {
    const [access] = sessionCookies({ ...session, expiresAt: NOW / 1000 - 60 }, NOW);

    expect(access.maxAge).toBe(0);
  });

  it("falls back to an hour when the token does not say when it expires", () => {
    const [access] = sessionCookies({ ...session, expiresAt: null }, NOW);

    expect(access.maxAge).toBe(ACCESS_TOKEN_FALLBACK_MAX_AGE_SECONDS);
  });

  it("empties and expires both cookies when signing out", () => {
    expect(clearedSessionCookies()).toEqual([
      { name: ACCESS_TOKEN_COOKIE, value: "", maxAge: 0 },
      { name: REFRESH_TOKEN_COOKIE, value: "", maxAge: 0 },
    ]);
  });
});

describe("serializing a session cookie", () => {
  it("keeps the token away from scripts and from other sites", () => {
    const serialized = serializeSessionCookie({ name: "a", value: "b", maxAge: 60 }, false);

    expect(serialized).toContain("HttpOnly");
    expect(serialized).toContain("SameSite=Lax");
    expect(serialized).toContain("Path=/");
    expect(serialized).toContain("Max-Age=60");
  });

  it("refuses plain HTTP outside development", () => {
    expect(serializeSessionCookie({ name: "a", value: "b", maxAge: 60 }, true)).toContain("Secure");
    expect(serializeSessionCookie({ name: "a", value: "b", maxAge: 60 }, false)).not.toContain("Secure");
  });

  it("escapes a value that would otherwise end the cookie early", () => {
    const serialized = serializeSessionCookie({ name: "a", value: "b; Path=/evil", maxAge: 1 }, false);

    expect(serialized.startsWith("a=b%3B%20Path%3D%2Fevil;")).toBe(true);
  });
});

describe("reading a cookie back", () => {
  it("finds the one asked for among several", () => {
    const headers = headersWith(`theme=dark; ${ACCESS_TOKEN_COOKIE}=abc; other=1`);

    expect(readAccessTokenCookie(headers)).toBe("abc");
  });

  it("does not mistake a cookie whose name merely ends the same way", () => {
    expect(readCookie(headersWith(`not_${ACCESS_TOKEN_COOKIE}=abc`), ACCESS_TOKEN_COOKIE)).toBeNull();
  });

  it("decodes what serializing encoded", () => {
    const cookie = serializeSessionCookie({ name: REFRESH_TOKEN_COOKIE, value: "a b/c", maxAge: 1 }, false);
    const value = cookie.split(";")[0];

    expect(readRefreshTokenCookie(headersWith(value))).toBe("a b/c");
  });

  it("reads a cleared cookie as no cookie at all", () => {
    expect(readAccessTokenCookie(headersWith(`${ACCESS_TOKEN_COOKIE}=`))).toBeNull();
  });

  it("is null when nothing was sent", () => {
    expect(readAccessTokenCookie(new Headers())).toBeNull();
    expect(readCookie(headersWith("malformed"), ACCESS_TOKEN_COOKIE)).toBeNull();
  });
});

describe("attaching cookies to a response", () => {
  it("sends both, as separate headers a browser will keep apart", () => {
    const response = withSessionCookies(new Response("{}"), sessionCookies(session, NOW), false);

    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.getSetCookie()[0]).toContain(ACCESS_TOKEN_COOKIE);
    expect(response.headers.getSetCookie()[1]).toContain(REFRESH_TOKEN_COOKIE);
  });

  it("marks them Secure in production only, by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(withSessionCookies(new Response("{}"), clearedSessionCookies()).headers.getSetCookie()[0]).toContain(
      "Secure",
    );
    vi.stubEnv("NODE_ENV", "development");
    expect(withSessionCookies(new Response("{}"), clearedSessionCookies()).headers.getSetCookie()[0]).not.toContain(
      "Secure",
    );
    vi.unstubAllEnvs();
  });

  it("counts the token's life from now when no time is given", () => {
    const [access] = sessionCookies({ ...session, expiresAt: Math.floor(Date.now() / 1000) + 60 });
    expect(access.maxAge).toBeGreaterThan(55);
    expect(access.maxAge).toBeLessThanOrEqual(60);
  });
});
