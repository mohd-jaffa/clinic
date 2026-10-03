import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthClient } from "@/features/auth/api.client";
import { apiRoutes } from "@/lib/query/keys";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { ok: true } }) });
});

const sent = () => {
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(String(init.body)) };
};

const tokens = { accessToken: "a-1", refreshToken: "r-1" };

describe("AuthClient", () => {
  it.each([
    ["signIn", () => AuthClient.signIn({ identifier: "asha@example.com", password: "p" }), apiRoutes.auth.login],
    ["register", () => AuthClient.register({ fullName: "Asha" } as never), apiRoutes.auth.register],
    [
      "resendConfirmation",
      () => AuthClient.resendConfirmation({ email: "asha@example.com" }),
      apiRoutes.auth.resendConfirmation,
    ],
    ["confirmEmail", () => AuthClient.confirmEmail(tokens), apiRoutes.auth.confirm],
    [
      "requestPasswordReset",
      () => AuthClient.requestPasswordReset({ email: "asha@example.com" }),
      apiRoutes.auth.passwordReset,
    ],
    [
      "completePasswordReset",
      () => AuthClient.completePasswordReset({ ...tokens, password: " exact " }),
      apiRoutes.auth.passwordResetComplete,
    ],
    [
      "changePassword",
      () => AuthClient.changePassword({ currentPassword: "old", newPassword: "new-password" }),
      apiRoutes.auth.password,
    ],
  ])("%s posts to its endpoint and hands back the answer", async (_, call, route) => {
    await expect(call()).resolves.toEqual({ ok: true });
    expect(sent()).toMatchObject({ url: route, method: "POST" });
  });

  it("sends the new password exactly as typed", async () => {
    await AuthClient.completePasswordReset({ ...tokens, password: " exact " });
    expect(sent().body).toEqual({ ...tokens, password: " exact " });
  });

  it("changes the name or mobile on the profile, sending only what changes", async () => {
    await expect(AuthClient.updateProfile({ fullName: "Asha M" })).resolves.toEqual({ ok: true });
    expect(sent()).toEqual({ url: apiRoutes.auth.profile, method: "PATCH", body: { fullName: "Asha M" } });
  });

  it("sends both passwords exactly as typed", async () => {
    await AuthClient.changePassword({ currentPassword: " old ", newPassword: " new-one " });
    expect(sent().body).toEqual({ currentPassword: " old ", newPassword: " new-one " });
  });

  it("signs out through the logout endpoint, with no token in sight", async () => {
    await AuthClient.signOut();
    expect(sent()).toEqual({ url: apiRoutes.auth.logout, method: "POST", body: undefined });
  });
});
