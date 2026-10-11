import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getAppointment, changeAppointment } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAppointment: vi.fn(),
  changeAppointment: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ getAppointment, changeAppointment }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, PATCH } = await import("@/app/api/appointments/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "a-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const patch = async (body: unknown) =>
  answerOf(await PATCH(apiRequest("/api/appointments/a-1", { method: "PATCH", body, headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.view", "appointments.edit"]));
  getAppointment.mockResolvedValue({ id: "a-1", patientName: "Rohan Mehta" });
  changeAppointment.mockResolvedValue({ id: "a-1", status: "SCHEDULED" });
});

describe("GET /api/appointments/[id] (D160)", () => {
  it("reads the appointment, for appointments.view", async () => {
    const answer = await answerOf(await GET(apiRequest("/api/appointments/a-1", { headers: auth }), params));
    expect(answer).toMatchObject({ status: 200, body: { data: { patientName: "Rohan Mehta" } } });
    expect(getAppointment).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "a-1");
  });

  it("refuses someone who may not see appointments", async () => {
    getSession.mockResolvedValue(member(["patients.view"]));
    expect((await answerOf(await GET(apiRequest("/api/appointments/a-1", { headers: auth }), params))).status).toBe(
      403,
    );
  });
});

describe("PATCH /api/appointments/[id] (D161)", () => {
  it("changes its notes as parsed, for appointments.edit", async () => {
    expect(await patch({ notes: " Bring reports " })).toMatchObject({ status: 200, body: { data: { id: "a-1" } } });
    expect(changeAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "a-1",
      { notes: "Bring reports" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a body it cannot read, someone who may only see, and a view-only clinic", async () => {
    expect(await patch({ notes: "x", doctorId: "d-1" })).toMatchObject({ status: 400 });
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await patch({ notes: "x" })).status).toBe(403);
    const session = member(["appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await patch({ notes: "x" })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(changeAppointment).not.toHaveBeenCalled();
  });
});
