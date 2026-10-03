import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getPatient, updatePatient } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPatient: vi.fn(),
  updatePatient: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/api", () => ({ getPatient, updatePatient }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, PATCH } = await import("@/app/api/patients/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "p-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "patients.edit"]));
  getPatient.mockResolvedValue({ id: "p-1", name: "Rohan Mehta" });
  updatePatient.mockResolvedValue({ id: "p-1", name: "Rohan M" });
});

describe("GET /api/patients/[id]", () => {
  it("answers with the patient, for patients.view", async () => {
    const { status, body } = await answerOf(await GET(apiRequest("/api/patients/p-1", { headers: auth }), params));
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { id: "p-1" } } });
    expect(getPatient).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "p-1");
    getSession.mockResolvedValue(member(["expenses.view"]));
    expect((await answerOf(await GET(apiRequest("/api/patients/p-1", { headers: auth }), params))).status).toBe(403);
  });
});

describe("PATCH /api/patients/[id]", () => {
  const patch = (body: unknown) =>
    PATCH(apiRequest("/api/patients/p-1", { method: "PATCH", body, headers: auth }), params);

  it("changes only the fields sent, for patients.edit", async () => {
    expect(await answerOf(await patch({ fullName: " Rohan  M " }))).toMatchObject({
      status: 200,
      body: { data: { name: "Rohan M" } },
    });
    expect(updatePatient).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "p-1",
      { fullName: "Rohan M" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a field that is not right, and someone who may only see", async () => {
    expect((await answerOf(await patch({ phone: "123" }))).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view"]));
    expect((await answerOf(await patch({ fullName: "Rohan M" }))).status).toBe(403);
    expect(updatePatient).not.toHaveBeenCalled();
  });
});
