import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, resendInvite } = vi.hoisted(() => ({ getSession: vi.fn(), resendInvite: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/invites", () => ({ resendInvite }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/team/invites/[id]/resend/route");

const params = { params: Promise.resolve({ id: "m-9" }) };
const call = () =>
  POST(
    apiRequest("/api/team/invites/m-9/resend", { method: "POST", headers: { authorization: "Bearer tok" } }),
    params,
  );

beforeEach(() => {
  vi.clearAllMocks();
  resendInvite.mockResolvedValue({ id: "m-9", name: "Meera Pillai" });
});

describe("POST /api/team/invites/[id]/resend (plan §8.4)", () => {
  it("resends the invite named for team.manage, as the server", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
    expect(await answerOf(await call())).toMatchObject({ status: 200, body: { data: { id: "m-9" } } });
    expect(resendInvite).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "service-client",
      "m-9",
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses anyone without team.manage", async () => {
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: ["patients.view"] },
    });
    expect(await answerOf(await call())).toMatchObject({ status: 403 });
    expect(resendInvite).not.toHaveBeenCalled();
  });
});
