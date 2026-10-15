import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, updateTreatment } = vi.hoisted(() => ({ getSession: vi.fn(), updateTreatment: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/treatments/records", () => ({ updateTreatment }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PATCH } = await import("@/app/api/treatments/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "t-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const patch = async (body: unknown) =>
  answerOf(await PATCH(apiRequest("/api/treatments/t-1", { method: "PATCH", headers: auth, body }), params));
const due = { part: "NEXT_DUE", changes: { nextDueOn: "2026-10-22" }, seen: { nextDueOn: null } };

beforeEach(() => {
  vi.clearAllMocks();
  updateTreatment.mockResolvedValue({ nextDueOn: "2026-10-22" });
});

describe("PATCH /api/treatments/[id] (D251, D252, D259)", () => {
  it("saves its details or its next sitting from the copy read, for visits.edit", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
    expect(await patch(due)).toMatchObject({ status: 200, body: { data: { nextDueOn: "2026-10-22" } } });
    expect(updateTreatment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "t-1",
      due,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one without visits.edit, and a part it does not know", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view"]));
    expect((await patch(due)).status).toBe(403);
    getSession.mockResolvedValue(member(["visits.edit"]));
    expect((await patch({ ...due, part: "STATUS" })).status).toBe(400);
    expect(updateTreatment).not.toHaveBeenCalled();
  });
});
