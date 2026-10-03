import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, revokeInvite } = vi.hoisted(() => ({ getSession: vi.fn(), revokeInvite: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/invites", () => ({ revokeInvite }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { DELETE } = await import("@/app/api/team/invites/[id]/route");

const params = { params: Promise.resolve({ id: "m-9" }) };
const call = () =>
  DELETE(apiRequest("/api/team/invites/m-9", { method: "DELETE", headers: { authorization: "Bearer tok" } }), params);

beforeEach(() => {
  vi.clearAllMocks();
  revokeInvite.mockResolvedValue({ id: "m-9", name: "Meera Pillai" });
});

describe("DELETE /api/team/invites/[id] (plan §8.4)", () => {
  it("revokes the invite named for team.manage, as the server", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
    expect(await answerOf(await call())).toMatchObject({ status: 200, body: { data: { id: "m-9" } } });
    expect(revokeInvite).toHaveBeenCalledWith(
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
    expect(revokeInvite).not.toHaveBeenCalled();
  });
});
