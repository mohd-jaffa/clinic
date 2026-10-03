import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, removeClosure } = vi.hoisted(() => ({ getSession: vi.fn(), removeClosure: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/clinic/closures", () => ({ removeClosure }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { DELETE } = await import("@/app/api/closures/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "c-1" }) };
const remove = () => DELETE(apiRequest("/api/closures/c-1", { method: "DELETE", headers: auth }), params);

beforeEach(() => {
  vi.clearAllMocks();
  const session = aSession();
  getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
  removeClosure.mockResolvedValue({ id: "c-1", reason: "Diwali" });
});

describe("DELETE /api/closures/[id] (D84)", () => {
  it("removes the one named for settings.manage, and answers with it", async () => {
    expect(await answerOf(await remove())).toMatchObject({ status: 200, body: { data: { reason: "Diwali" } } });
    expect(removeClosure).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "c-1",
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a member without settings.manage", async () => {
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: ["patients.view"] },
    });
    expect(await answerOf(await remove())).toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
    expect(removeClosure).not.toHaveBeenCalled();
  });
});
