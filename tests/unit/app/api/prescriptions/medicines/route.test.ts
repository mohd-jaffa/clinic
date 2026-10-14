import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, medicineSuggestions } = vi.hoisted(() => ({
  getSession: vi.fn(),
  medicineSuggestions: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/prescriptions/api", () => ({ medicineSuggestions }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/prescriptions/medicines/route");

const DOCTOR = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) =>
  answerOf(await GET(apiRequest(`/api/prescriptions/medicines${query}`, { headers: auth })));
const line = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: 5,
  instructions: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.view", "prescriptions.write"]));
  medicineSuggestions.mockResolvedValue([line]);
});

describe("GET /api/prescriptions/medicines (D211)", () => {
  it("finds the clinic's medicines beginning with what is typed, the doctor's own first", async () => {
    expect(await get(`?q=%20para%20&doctorId=${DOCTOR}`)).toMatchObject({ status: 200, body: { data: [line] } });
    expect(medicineSuggestions).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      q: "para",
      doctorId: DOCTOR,
    });
  });

  it("refuses nothing typed, a doctor it cannot read, and someone who may not read visits", async () => {
    expect((await get(`?doctorId=${DOCTOR}`)).status).toBe(400);
    expect((await get("?q=para&doctorId=nope")).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await get(`?q=para&doctorId=${DOCTOR}`)).status).toBe(403);
    expect(medicineSuggestions).not.toHaveBeenCalled();
  });
});
