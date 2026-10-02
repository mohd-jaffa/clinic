import { describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, changePassword } = vi.hoisted(() => ({ getSession: vi.fn(), changePassword: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/auth/password", () => ({ changePassword }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/password/route");

const change = (body: unknown) =>
  POST(apiRequest("/api/auth/password", { body, headers: { authorization: "Bearer tok" } }));

describe("POST /api/auth/password", () => {
  it("changes the signed-in person's password and answers with the fresh session it starts", async () => {
    const session = aSession();
    getSession.mockResolvedValue(session);
    changePassword.mockResolvedValue(aSession({ accessToken: "fresh-access", refreshToken: "fresh-refresh" }));

    const response = await change({ currentPassword: "old secret", newPassword: "new secret " });

    expect(changePassword).toHaveBeenCalledWith("anon-client", "service-client", session, {
      currentPassword: "old secret",
      newPassword: "new secret ",
    });
    expect(response.headers.getSetCookie().join()).toContain("fresh-access");
  });

  it("is open to a read-only clinic's member (plan §7.2)", async () => {
    getSession.mockResolvedValue(
      aSession({
        subscription: { plan: "TRIAL", validUntil: "2026-01-01", state: "READ_ONLY", readOnlyFrom: "2026-01-09" },
      }),
    );
    changePassword.mockResolvedValue(aSession());
    expect((await change({ currentPassword: "old secret", newPassword: "new secret" })).status).toBe(200);
  });

  it("works for the platform admin, who has no clinic", async () => {
    getSession.mockResolvedValue(aSession({ membership: null, subscription: null }));
    changePassword.mockResolvedValue(aSession({ membership: null, subscription: null }));
    expect((await change({ currentPassword: "old secret", newPassword: "new secret" })).status).toBe(200);
  });

  it("asks for a session first", async () => {
    const { status } = await answerOf(await POST(apiRequest("/api/auth/password", { body: {} })));
    expect(status).toBe(401);
  });
});
