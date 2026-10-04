import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, restorePatient } = vi.hoisted(() => ({ getSession: vi.fn(), restorePatient: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/api", () => ({ restorePatient }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/patients/[id]/restore/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "p-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async () => answerOf(await POST(apiRequest("/api/patients/p-1/restore", { headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "patients.edit"]));
  restorePatient.mockResolvedValue({ id: "p-1", name: "Rohan Mehta" });
});

describe("POST /api/patients/[id]/restore (D103)", () => {
  it("restores the patient, for patients.edit", async () => {
    expect(await post()).toMatchObject({ status: 200, body: { data: { id: "p-1" } } });
    expect(restorePatient).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "p-1",
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses someone who may only see, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view"]));
    expect((await post()).status).toBe(403);
    const session = member(["patients.view", "patients.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post()).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(restorePatient).not.toHaveBeenCalled();
  });
});
