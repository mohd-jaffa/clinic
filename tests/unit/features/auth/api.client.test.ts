import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthClient } from "@/features/auth/api.client";
import { apiRoutes } from "@/lib/query/keys";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("AuthClient", () => {
  it("signs out through the logout endpoint, with no token in sight", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { signedOut: true } }) });

    await expect(AuthClient.signOut()).resolves.toEqual({ signedOut: true });
    expect(mockFetch).toHaveBeenCalledWith(apiRoutes.auth.logout, expect.objectContaining({ method: "POST" }));
    expect(JSON.stringify(mockFetch.mock.calls[0][1])).not.toContain("token");
  });
});
