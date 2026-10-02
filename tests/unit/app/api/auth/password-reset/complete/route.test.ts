import { describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { completePasswordReset } = vi.hoisted(() => ({ completePasswordReset: vi.fn() }));
vi.mock("@/features/auth/password", () => ({ completePasswordReset }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/password-reset/complete/route");

describe("POST /api/auth/password-reset/complete", () => {
  it("sets the new password from the link's tokens, and signs the person in", async () => {
    completePasswordReset.mockResolvedValue(aSession());
    const payload = { accessToken: "a", refreshToken: "r", password: "new secret" };
    const response = await POST(apiRequest("/api/auth/password-reset/complete", { body: payload }));

    expect(completePasswordReset).toHaveBeenCalledWith("anon-client", "service-client", payload);
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it("refuses a password too short to be one", async () => {
    const payload = { accessToken: "a", refreshToken: "r", password: "short" };
    const { status } = await answerOf(await POST(apiRequest("/api/auth/password-reset/complete", { body: payload })));
    expect(status).toBe(400);
  });
});
