import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getPatientSummary } = vi.hoisted(() => ({ getSession: vi.fn(), getPatientSummary: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/summary", () => ({ getPatientSummary }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/patients/[id]/summary/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "p-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async () => answerOf(await GET(apiRequest("/api/patients/p-1/summary", { headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getPatientSummary.mockResolvedValue({ nextAppointment: null });
});

describe("GET /api/patients/[id]/summary (plan §10.3)", () => {
  it("reads where the patient stands, for patients.view", async () => {
    getSession.mockResolvedValue(member(["patients.view"]));
    expect(await get()).toMatchObject({ status: 200, body: { data: { nextAppointment: null } } });
    expect(getPatientSummary).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "p-1");
  });

  it("refuses someone who may not see patients", async () => {
    getSession.mockResolvedValue(member([]));
    expect((await get()).status).toBe(403);
  });
});
