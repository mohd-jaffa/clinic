import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, savePrescription } = vi.hoisted(() => ({ getSession: vi.fn(), savePrescription: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/prescriptions/records", () => ({ savePrescription }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PUT } = await import("@/app/api/visits/[id]/prescription/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "v-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const put = async (body: unknown) =>
  answerOf(await PUT(apiRequest("/api/visits/v-1/prescription", { method: "PUT", headers: auth, body }), params));
const typed = {
  items: [
    {
      medicine: " Paracetamol ",
      strength: "500 mg",
      dose: "",
      frequency: "1-0-1",
      timing: "AFTER_FOOD",
      durationDays: "5",
      instructions: "",
    },
  ],
  advice: "",
  printDiagnosis: false,
};
const read = {
  items: [
    {
      medicine: "Paracetamol",
      strength: "500 mg",
      dose: null,
      frequency: "1-0-1",
      timing: "AFTER_FOOD",
      durationDays: 5,
      instructions: null,
    },
  ],
  advice: null,
  printDiagnosis: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.view", "prescriptions.write"]));
  savePrescription.mockResolvedValue({ prescription: read });
});

describe("PUT /api/visits/[id]/prescription (D210, D215)", () => {
  it("saves the whole prescription as read, for whoever reads visits — the database asks who may write it", async () => {
    expect(await put({ prescription: typed, seen: read })).toMatchObject({
      status: 200,
      body: { data: { prescription: read } },
    });
    expect(savePrescription).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "v-1",
      { prescription: read, seen: read },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    expect(
      await put({ prescription: { ...typed, items: [{ ...typed.items[0], durationDays: "400" }] }, seen: null }),
    ).toMatchObject({ status: 400 });
    expect(await put({ prescription: typed })).toMatchObject({ status: 400 });
    expect(savePrescription).not.toHaveBeenCalled();
  });

  it("refuses someone who may not read visits, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
    expect((await put({ prescription: typed, seen: null })).status).toBe(403);
    const session = member(["visits.view", "prescriptions.write"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await put({ prescription: typed, seen: null })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(savePrescription).not.toHaveBeenCalled();
  });
});
