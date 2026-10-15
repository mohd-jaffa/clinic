import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, createTreatment } = vi.hoisted(() => ({ getSession: vi.fn(), createTreatment: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/treatments/records", () => ({ createTreatment }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/treatments/route");

const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/treatments", { method: "POST", headers: auth, body })));
const PATIENT = "11111111-1111-4111-8111-111111111111";
const VISIT = "22222222-2222-4222-8222-222222222222";
const typed = {
  patientId: PATIENT,
  visitId: VISIT,
  doctorId: "",
  start: "IN_PROGRESS",
  name: "Root canal",
  description: "",
  estimatedCost: "4,500",
  note: "Access opened",
  nextDueOn: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  createTreatment.mockResolvedValue({ id: "t-1", name: "Root canal" });
});

describe("POST /api/treatments (plan §14.1; D252, D258)", () => {
  it("adds one for visits.edit, as its schema reads it", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
    expect(await post(typed)).toMatchObject({ status: 201, body: { data: { id: "t-1", name: "Root canal" } } });
    expect(createTreatment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      expect.objectContaining({ visitId: VISIT, doctorId: null, start: "IN_PROGRESS", estimatedCost: 450000 }),
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one without visits.edit, a view-only clinic, and what it cannot read", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.create"]));
    expect((await post(typed)).status).toBe(403);
    const session = member(["visits.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post(typed)).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    getSession.mockResolvedValue(member(["visits.edit"]));
    expect((await post({ ...typed, name: "" })).status).toBe(400);
    expect(createTreatment).not.toHaveBeenCalled();
  });
});
