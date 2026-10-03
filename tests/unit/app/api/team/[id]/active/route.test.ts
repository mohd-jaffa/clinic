import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, setMemberActive } = vi.hoisted(() => ({ getSession: vi.fn(), setMemberActive: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/members", () => ({ setMemberActive }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/team/[id]/active/route");

const params = { params: Promise.resolve({ id: "m-2" }) };
const post = (body: unknown) =>
  POST(apiRequest("/api/team/m-2/active", { method: "POST", body, headers: { authorization: "Bearer tok" } }), params);

beforeEach(() => {
  vi.clearAllMocks();
  const session = aSession();
  getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
  setMemberActive.mockResolvedValue({ id: "m-2", status: "INACTIVE" });
});

describe("POST /api/team/[id]/active (plan §8.6)", () => {
  it("deactivates or reactivates the member named for team.manage", async () => {
    expect(await answerOf(await post({ active: false }))).toMatchObject({
      status: 200,
      body: { data: { status: "INACTIVE" } },
    });
    expect(setMemberActive).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "m-2",
      false,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a body that is not right", async () => {
    expect((await answerOf(await post({ active: "no" }))).status).toBe(400);
    expect(setMemberActive).not.toHaveBeenCalled();
  });
});
