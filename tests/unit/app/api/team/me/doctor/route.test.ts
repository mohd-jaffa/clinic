import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, updateOwnDoctor } = vi.hoisted(() => ({ getSession: vi.fn(), updateOwnDoctor: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/members", () => ({ updateOwnDoctor }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PATCH } = await import("@/app/api/team/me/doctor/route");

const patch = (body: unknown) =>
  PATCH(apiRequest("/api/team/me/doctor", { method: "PATCH", body, headers: { authorization: "Bearer tok" } }));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(aSession());
  updateOwnDoctor.mockResolvedValue({ id: "member-1", seesPatients: false });
});

describe("PATCH /api/team/me/doctor (plan §3.1, D96)", () => {
  it("changes the owner's own doctor profile, as them", async () => {
    expect(await answerOf(await patch({ seesPatients: false }))).toMatchObject({
      status: 200,
      body: { data: { seesPatients: false } },
    });
    expect(updateOwnDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "member-1", role: "OWNER" }),
      { seesPatients: false },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses anyone but the owner, and a body that is not right", async () => {
    expect((await answerOf(await patch({ seesPatients: "no" }))).status).toBe(400);
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: ["team.manage"] },
    });
    expect((await answerOf(await patch({ seesPatients: true }))).status).toBe(403);
    expect(updateOwnDoctor).not.toHaveBeenCalled();
  });
});
