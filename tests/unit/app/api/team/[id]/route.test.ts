import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getMember, updateMember } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMember: vi.fn(),
  updateMember: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/members", () => ({ getMember, updateMember }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, PATCH } = await import("@/app/api/team/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "m-2" }) };
const asOwner = () => {
  const session = aSession();
  getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
};

beforeEach(() => {
  vi.clearAllMocks();
  asOwner();
  getMember.mockResolvedValue({ id: "m-2", name: "Rahul Nair" });
  updateMember.mockResolvedValue({ id: "m-2", jobTitle: "Nurse" });
});

describe("/api/team/[id] (plan §8.6)", () => {
  it("reads the member named for team.manage, as them", async () => {
    expect(
      await answerOf(await GET(apiRequest("/api/team/m-2", { method: "GET", headers: auth }), params)),
    ).toMatchObject({
      status: 200,
      body: { data: { name: "Rahul Nair" } },
    });
    expect(getMember).toHaveBeenCalledWith(expect.objectContaining({ supabase: "anon-client" }), "m-2");
  });

  it("changes what is named, tidied, and refuses what is not right or not theirs", async () => {
    const patch = (body: unknown) =>
      PATCH(apiRequest("/api/team/m-2", { method: "PATCH", body, headers: auth }), params);
    expect((await answerOf(await patch({ jobTitle: " Nurse " }))).status).toBe(200);
    expect(updateMember).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "m-2",
      { jobTitle: "Nurse" },
      expect.stringMatching(/^req_/),
    );
    expect((await answerOf(await patch({ permissions: ["visits.edit"] }))).status).toBe(400);

    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: ["patients.view"] },
    });
    expect((await answerOf(await patch({ jobTitle: "Nurse" }))).status).toBe(403);
  });
});
