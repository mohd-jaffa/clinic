import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, saveVitals } = vi.hoisted(() => ({ getSession: vi.fn(), saveVitals: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/visits/records", () => ({ saveVitals }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PUT } = await import("@/app/api/appointments/[id]/vitals/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "a-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const put = async (body: unknown) =>
  answerOf(await PUT(apiRequest("/api/appointments/a-1/vitals", { method: "PUT", headers: auth, body }), params));
const typed = {
  systolic: "",
  diastolic: "",
  pulse: "",
  temperatureF: "",
  spo2: "",
  respiratoryRate: "",
  weightKg: "58",
  heightCm: "",
};
const read = {
  systolic: null,
  diastolic: null,
  pulse: null,
  temperatureF: null,
  spo2: null,
  respiratoryRate: null,
  weightKg: 58,
  heightCm: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.create"]));
  saveVitals.mockResolvedValue({ visitId: "v-1", vitals: read });
});

describe("PUT /api/appointments/[id]/vitals — a waiting patient's vitals (D203)", () => {
  it("saves them to the appointment, opening its visit, for visits.create", async () => {
    expect(await put({ vitals: typed, seen: null })).toMatchObject({
      status: 200,
      body: { data: { visitId: "v-1", vitals: read } },
    });
    expect(saveVitals).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { appointmentId: "a-1" },
      { vitals: read, seen: null },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    expect(await put({ vitals: { ...typed, weightKg: "heavy" }, seen: null })).toMatchObject({ status: 400 });
    expect(saveVitals).not.toHaveBeenCalled();
  });

  it("refuses someone who may only read visits, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
    expect((await put({ vitals: typed, seen: null })).status).toBe(403);
    const session = member(["visits.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await put({ vitals: typed, seen: null })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(saveVitals).not.toHaveBeenCalled();
  });
});
