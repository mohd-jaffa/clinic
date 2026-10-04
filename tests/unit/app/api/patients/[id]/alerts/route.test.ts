import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listAlerts, addAlert } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAlerts: vi.fn(),
  addAlert: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/alerts", () => ({ listAlerts, addAlert }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, POST } = await import("@/app/api/patients/[id]/alerts/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "p-1" }) };
const member = (permissions: string[], state: "ACTIVE" | "READ_ONLY" = "ACTIVE") => {
  const session = aSession();
  return {
    ...session,
    membership: { ...session.membership!, role: "STAFF", permissions },
    subscription: { ...session.subscription!, state },
  };
};
const post = (body: unknown) =>
  POST(apiRequest("/api/patients/p-1/alerts", { method: "POST", body, headers: auth }), params);

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
  listAlerts.mockResolvedValue([{ id: "a-1", label: "Penicillin" }]);
  addAlert.mockResolvedValue({ id: "a-2", label: "Peanuts" });
});

describe("GET /api/patients/[id]/alerts (plan §10.4)", () => {
  it("answers with the patient's alerts, for visits.view — a view-only clinic too", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view"], "READ_ONLY"));
    const { status, body } = await answerOf(
      await GET(apiRequest("/api/patients/p-1/alerts", { method: "GET", headers: auth }), params),
    );
    expect({ status, body }).toMatchObject({ status: 200, body: { data: [{ id: "a-1" }] } });
    expect(listAlerts).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "p-1");
  });

  it("is refused to someone who may only see patients", async () => {
    getSession.mockResolvedValue(member(["patients.view"]));
    expect(
      (await answerOf(await GET(apiRequest("/api/patients/p-1/alerts", { method: "GET", headers: auth }), params)))
        .status,
    ).toBe(403);
    expect(listAlerts).not.toHaveBeenCalled();
  });
});

describe("POST /api/patients/[id]/alerts", () => {
  it("adds an alert, parsed and tidied, for visits.edit", async () => {
    expect(await answerOf(await post({ kind: "ALLERGY", label: "  Peanuts ", note: "" }))).toMatchObject({
      status: 201,
      body: { data: { id: "a-2" } },
    });
    expect(addAlert).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "p-1",
      { kind: "ALLERGY", label: "Peanuts", note: null },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a kind it does not know, someone who may only read visits, and a view-only clinic", async () => {
    expect((await answerOf(await post({ kind: "HABIT", label: "Smoking" }))).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "visits.view"]));
    expect((await answerOf(await post({ kind: "ALLERGY", label: "Peanuts" }))).status).toBe(403);
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"], "READ_ONLY"));
    expect(await answerOf(await post({ kind: "ALLERGY", label: "Peanuts" }))).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(addAlert).not.toHaveBeenCalled();
  });
});
