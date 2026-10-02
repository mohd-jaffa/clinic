import { describe, expect, it, vi } from "vitest";

import { authenticationError } from "@/lib/errors";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/auth/session/route");

describe("GET /api/auth/session", () => {
  it("answers who is signed in and where they stand, never a token", async () => {
    getSession.mockResolvedValue(aSession());
    const { status, body } = await answerOf(
      await GET(apiRequest("/api/auth/session", { method: "GET", headers: { authorization: "Bearer tok" } })),
    );

    expect(getSession).toHaveBeenCalledWith("service-client", "tok");
    expect(status).toBe(200);
    expect(body).toMatchObject({ data: { profile: { id: "user-1" }, membership: { clinicId: "clinic-1" } } });
    expect(JSON.stringify(body)).not.toMatch(/access-token|refresh-token/);
  });

  it("asks for a session when there is none, and refuses one that is no longer good", async () => {
    expect((await GET(apiRequest("/api/auth/session", { method: "GET" }))).status).toBe(401);
    getSession.mockImplementation(async () => {
      throw authenticationError("AUTH_SESSION_INVALID");
    });
    const { body } = await answerOf(
      await GET(apiRequest("/api/auth/session", { method: "GET", headers: { authorization: "Bearer old" } })),
    );
    expect(body).toMatchObject({ error: { code: "AUTH_SESSION_INVALID" } });
  });
});
