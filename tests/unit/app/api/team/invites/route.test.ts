import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, inviteMember } = vi.hoisted(() => ({ getSession: vi.fn(), inviteMember: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/invites", () => ({ inviteMember }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/team/invites/route");

const post = (body: unknown) =>
  POST(apiRequest("/api/team/invites", { method: "POST", body, headers: { authorization: "Bearer tok" } }));
const invite = {
  fullName: "Meera Pillai",
  email: "meera@example.com",
  role: "STAFF",
  jobTitle: "Front desk",
  permissions: ["patients.view"],
  doctor: { specialization: "", qualifications: "", registrationNumber: "", fee: "" },
};

beforeEach(() => {
  vi.clearAllMocks();
  const session = aSession();
  getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
  inviteMember.mockResolvedValue({ member: { id: "m-9" }, emailSent: true });
});

describe("POST /api/team/invites (plan §8.4)", () => {
  it("invites for team.manage, as the server, with the body tidied, and answers 201", async () => {
    expect(await answerOf(await post(invite))).toMatchObject({ status: 201, body: { data: { emailSent: true } } });
    expect(inviteMember).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "service-client",
      expect.objectContaining({ email: "meera@example.com", doctor: null }),
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a body that is not right, and anyone without team.manage", async () => {
    expect(await answerOf(await post({ ...invite, role: "OWNER" }))).toMatchObject({ status: 400 });
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: ["patients.view"] },
    });
    expect(await answerOf(await post(invite))).toMatchObject({ status: 403 });
    expect(inviteMember).not.toHaveBeenCalled();
  });
});
