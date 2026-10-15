import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, changeTreatmentStatus } = vi.hoisted(() => ({
  getSession: vi.fn(),
  changeTreatmentStatus: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/treatments/records", () => ({ changeTreatmentStatus }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/treatments/[id]/status/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "t-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/treatments/t-1/status", { method: "POST", headers: auth, body }), params));

beforeEach(() => {
  vi.clearAllMocks();
  changeTreatmentStatus.mockResolvedValue({ status: "CANCELLED" });
});

describe("POST /api/treatments/[id]/status (D250, D251)", () => {
  it("moves it from the status read, a cancellation with its reason, for visits.edit", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
    const body = { status: "CANCELLED", seen: "PLANNED", reason: "Patient declined" };
    expect(await post(body)).toMatchObject({ status: 200, body: { data: { status: "CANCELLED" } } });
    expect(changeTreatmentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "t-1",
      body,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one without visits.edit, and a reason with anything but a cancellation", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view"]));
    expect((await post({ status: "ON_HOLD", seen: "PLANNED" })).status).toBe(403);
    getSession.mockResolvedValue(member(["visits.edit"]));
    expect((await post({ status: "ON_HOLD", seen: "PLANNED", reason: "Away" })).status).toBe(400);
    expect(changeTreatmentStatus).not.toHaveBeenCalled();
  });
});
