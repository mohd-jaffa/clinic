import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE } from "@/features/auth/cookies";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), logout }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/logout/route");

beforeEach(() => {
  logout.mockReset();
  logout.mockResolvedValue({ signedOut: true });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session the cookie carries, and clears the cookies", async () => {
    const response = await POST(apiRequest("/api/auth/logout", { headers: { cookie: `${ACCESS_TOKEN_COOKIE}=tok` } }));

    expect(logout).toHaveBeenCalledWith("service-client", "tok");
    expect(response.headers.getSetCookie().every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });

  it("takes a bearer token as well", async () => {
    await POST(apiRequest("/api/auth/logout", { headers: { authorization: "Bearer tok-2" } }));
    expect(logout).toHaveBeenCalledWith("service-client", "tok-2");
  });

  it("signs out with nothing to revoke when there is no token, clearing the cookies all the same", async () => {
    const response = await POST(apiRequest("/api/auth/logout"));

    expect(logout).not.toHaveBeenCalled();
    await expect(answerOf(response)).resolves.toMatchObject({ status: 200, body: { data: { signedOut: true } } });
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });
});
