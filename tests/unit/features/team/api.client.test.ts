import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeamClient } from "@/features/team/api.client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: "m-9" } }) });
});

const sent = () => {
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body };
};

describe("TeamClient (plan §30)", () => {
  it("invites as typed, resends and revokes an invite at its own address", async () => {
    const invite = {
      fullName: "Meera",
      email: "meera@example.com",
      role: "STAFF" as const,
      jobTitle: "",
      permissions: [],
      doctor: { specialization: "", qualifications: "", registrationNumber: "", fee: "" },
    };
    await TeamClient.invite(invite);
    expect(sent()).toMatchObject({ url: "/api/team/invites", method: "POST", body: JSON.stringify(invite) });

    mockFetch.mockClear();
    await TeamClient.resend("m-9");
    expect(sent()).toMatchObject({ url: "/api/team/invites/m-9/resend", method: "POST" });

    mockFetch.mockClear();
    await TeamClient.revoke("m-9");
    expect(sent()).toMatchObject({ url: "/api/team/invites/m-9", method: "DELETE" });
  });

  it("asks what a link opens onto, and accepts it, with the token in the body", async () => {
    await TeamClient.previewInvite("tok");
    expect(sent()).toMatchObject({ url: "/api/auth/accept-invite/preview", method: "POST", body: '{"token":"tok"}' });

    mockFetch.mockClear();
    const accept = { token: "tok", fullName: "Meera", phone: "9876501234", password: "secret-pass" };
    await TeamClient.acceptInvite(accept);
    expect(sent()).toMatchObject({ url: "/api/auth/accept-invite", method: "POST", body: JSON.stringify(accept) });
  });
});
