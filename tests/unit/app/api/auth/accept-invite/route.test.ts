import { describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { acceptInvite } = vi.hoisted(() => ({ acceptInvite: vi.fn() }));
vi.mock("@/features/team/accept", () => ({ acceptInvite }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/accept-invite/route");

const TOKEN = "t".repeat(43);

describe("POST /api/auth/accept-invite (plan §8.5)", () => {
  it("accepts with the mobile made whole, and signs the person in, no token in the body", async () => {
    acceptInvite.mockResolvedValue(aSession());
    const body = { token: TOKEN, fullName: "Meera Pillai", phone: "98765 01234", password: "a secret pass" };
    const response = await POST(apiRequest("/api/auth/accept-invite", { body }));

    expect(acceptInvite).toHaveBeenCalledWith(
      "anon-client",
      "service-client",
      { ...body, phone: "+919876501234" },
      expect.stringMatching(/^req_/),
    );
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(JSON.stringify(await response.json())).not.toContain("access-token");
  });

  it("refuses a body that is not right", async () => {
    const body = { token: "short", fullName: "Meera", phone: "123", password: "short" };
    expect((await answerOf(await POST(apiRequest("/api/auth/accept-invite", { body })))).status).toBe(400);
  });
});
