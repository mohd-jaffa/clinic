import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE } from "@/features/auth/cookies";
import { authenticationError } from "@/lib/errors";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), login }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/auth/login/route");

beforeEach(() => {
  login.mockReset();
});

describe("POST /api/auth/login", () => {
  it("signs in with a mobile however it was typed, setting the session cookies", async () => {
    login.mockResolvedValue(aSession());
    const response = await POST(
      apiRequest("/api/auth/login", { body: { identifier: "98765 43210", password: " pass word " } }),
    );

    expect(login).toHaveBeenCalledWith("anon-client", "service-client", {
      phone: "+919876543210",
      password: " pass word ",
    });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join()).toContain(`${ACCESS_TOKEN_COOKIE}=access-token`);
  });

  it("refuses what is not an email or a mobile before asking anyone", async () => {
    const { status, body } = await answerOf(
      await POST(apiRequest("/api/auth/login", { body: { identifier: "asha", password: "x" } })),
    );
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(login).not.toHaveBeenCalled();
  });

  it("answers a refused sign-in with its code and no cookie", async () => {
    login.mockImplementation(async () => {
      throw authenticationError("AUTH_INVALID_CREDENTIALS");
    });
    const response = await POST(apiRequest("/api/auth/login", { body: { identifier: "a@b.co", password: "x" } }));
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
