import { describe, expect, it, vi } from "vitest";

import { REFRESH_TOKEN_COOKIE } from "@/features/auth/cookies";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { refreshSession } = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), refreshSession }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/refresh/route");

describe("POST /api/auth/refresh", () => {
  it("trades the refresh cookie for a fresh session", async () => {
    refreshSession.mockResolvedValue(aSession());
    const response = await POST(apiRequest("/api/auth/refresh", { headers: { cookie: `${REFRESH_TOKEN_COOKIE}=r1` } }));

    expect(refreshSession).toHaveBeenCalledWith("anon-client", "service-client", "r1");
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it("asks for a session when there is no refresh cookie", async () => {
    const { status, body } = await answerOf(await POST(apiRequest("/api/auth/refresh")));
    expect(status).toBe(401);
    expect(body).toMatchObject({ error: { code: "AUTH_SESSION_REQUIRED" } });
  });
});
