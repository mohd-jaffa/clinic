import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, updateAlert } = vi.hoisted(() => ({ getSession: vi.fn(), updateAlert: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/alerts", () => ({ updateAlert }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PATCH } = await import("@/app/api/patients/[id]/alerts/[alertId]/route");

const params = { params: Promise.resolve({ id: "p-1", alertId: "a-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const patch = (body: unknown) =>
  PATCH(
    apiRequest("/api/patients/p-1/alerts/a-1", { method: "PATCH", body, headers: { authorization: "Bearer tok" } }),
    params,
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
  updateAlert.mockResolvedValue({ id: "a-1", active: false });
});

describe("PATCH /api/patients/[id]/alerts/[alertId] (D118, D119)", () => {
  it("turns an alert off, or changes its name and note, for visits.edit", async () => {
    expect(await answerOf(await patch({ active: false }))).toMatchObject({
      status: 200,
      body: { data: { id: "a-1" } },
    });
    expect(updateAlert).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "p-1",
      "a-1",
      { active: false },
      expect.stringMatching(/^req_/),
    );
    await patch({ label: "Amoxicillin", note: "" });
    expect(updateAlert).toHaveBeenLastCalledWith(
      expect.anything(),
      "p-1",
      "a-1",
      { label: "Amoxicillin", note: null },
      expect.anything(),
    );
  });

  it("refuses turning one on again, a change of kind's worth of nonsense, and someone who may only read", async () => {
    expect((await answerOf(await patch({ active: true }))).status).toBe(400);
    expect((await answerOf(await patch({ label: "" }))).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "visits.view"]));
    expect((await answerOf(await patch({ active: false }))).status).toBe(403);
    expect(updateAlert).not.toHaveBeenCalled();
  });
});
