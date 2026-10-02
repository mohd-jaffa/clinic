import { describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { confirmEmail } = vi.hoisted(() => ({ confirmEmail: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), confirmEmail }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/confirm/route");

describe("POST /api/auth/confirm", () => {
  it("confirms the address from the link's tokens, and signs the owner in", async () => {
    confirmEmail.mockResolvedValue(aSession());
    const response = await POST(apiRequest("/api/auth/confirm", { body: { accessToken: "a", refreshToken: "r" } }));

    expect(confirmEmail).toHaveBeenCalledWith("anon-client", "service-client", { accessToken: "a", refreshToken: "r" });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it("refuses a landing without the link's tokens", async () => {
    const { status } = await answerOf(await POST(apiRequest("/api/auth/confirm", { body: { accessToken: "a" } })));
    expect(status).toBe(400);
  });
});
