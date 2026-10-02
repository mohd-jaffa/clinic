import { describe, expect, it } from "vitest";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/features/auth/cookies";
import { withSessionRoute, withSignOutRoute } from "@/features/auth/route";
import { authenticationError } from "@/lib/errors";
import { aSession } from "@tests/support/auth";

const session = aSession();
const request = () => new Request("https://clinicdesk.test/api/auth/login", { method: "POST" });

describe("a route that issues a session", () => {
  it("sets both cookies", async () => {
    const response = await withSessionRoute(request(), async () => session);
    const cookies = response.headers.getSetCookie().join("\n");

    expect(cookies).toContain(`${ACCESS_TOKEN_COOKIE}=access-token`);
    expect(cookies).toContain(`${REFRESH_TOKEN_COOKIE}=refresh-token`);
  });

  it("answers with who they are and where they stand, and not with the tokens", async () => {
    const response = await withSessionRoute(request(), async () => session);
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(body.data).toEqual({
      profile: session.profile,
      membership: session.membership,
      subscription: session.subscription,
    });
    expect(JSON.stringify(body)).not.toContain("access-token");
    expect(JSON.stringify(body)).not.toContain("refresh-token");
  });

  it("sets no cookie when the sign-in was refused", async () => {
    const response = await withSessionRoute(request(), async () => {
      throw authenticationError("AUTH_INVALID_CREDENTIALS");
    });

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
});

describe("a route that ends a session", () => {
  it("expires both cookies", async () => {
    const response = await withSignOutRoute(request(), async () => ({ signedOut: true }));
    const cookies = response.headers.getSetCookie();

    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });

  it("expires them even when the handler failed, because the caller wanted out", async () => {
    const response = await withSignOutRoute(request(), async () => {
      throw authenticationError("AUTH_SESSION_INVALID");
    });

    expect(response.headers.getSetCookie()).toHaveLength(2);
  });
});
