import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, change } = vi.hoisted(() => ({ getSession: vi.fn(), change: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/clinic/catalogues", () => ({ expenseCategories: { change } }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PATCH } = await import("@/app/api/expense-categories/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "e-1" }) };
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const owner = () => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } };
};
const patch = (body: unknown) =>
  PATCH(apiRequest("/api/expense-categories/e-1", { method: "PATCH", body, headers: auth }), params);

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(owner());
  change.mockResolvedValue({ id: "e-1", name: "One", active: false });
});

describe("PATCH /api/expense-categories/[id] (D80)", () => {
  it("changes the one named for settings.manage: its details, tidied, or archiving it", async () => {
    expect((await answerOf(await patch({ details: { name: " Lab  fees " } }))).status).toBe(200);
    expect(change).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "e-1",
      { details: { name: "Lab fees" } },
      expect.stringMatching(/^req_/),
    );

    const { body } = await answerOf(await patch({ active: false }));
    expect(body).toMatchObject({ data: { active: false } });
    expect(change).toHaveBeenLastCalledWith(expect.anything(), "e-1", { active: false }, expect.any(String));
  });

  it("refuses a member without settings.manage, and a change that is not right", async () => {
    getSession.mockResolvedValue(staff(["patients.view"]));
    expect(await answerOf(await patch({ active: false }))).toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });

    getSession.mockResolvedValue(owner());
    expect(await answerOf(await patch({ details: { name: "" } }))).toMatchObject({
      status: 400,
      body: { error: { code: "VALIDATION_ERROR" } },
    });
    expect(await answerOf(await patch({ active: "no" }))).toMatchObject({ status: 400 });
    expect(change).not.toHaveBeenCalled();
  });
});
