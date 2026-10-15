import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, recordFollowUpContact } = vi.hoisted(() => ({
  getSession: vi.fn(),
  recordFollowUpContact: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/treatments/records", () => ({ recordFollowUpContact }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/follow-ups/contacts/route");

const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/follow-ups/contacts", { method: "POST", headers: auth, body })));
const VISIT = "22222222-2222-4222-8222-222222222222";
const typed = { kind: "VISIT", id: VISIT, outcome: "NO_ANSWER", note: "  Line   busy ", snoozeUntil: "2026-10-18" };
const NOTED = { id: "c-1", patientId: "p-1", outcome: "NO_ANSWER", snoozeUntil: "2026-10-18" };

beforeEach(() => {
  vi.clearAllMocks();
  recordFollowUpContact.mockResolvedValue(NOTED);
});

describe("POST /api/follow-ups/contacts (plan §14.3; D267, D271, D273)", () => {
  it("notes one for appointments.edit, or for visits.edit, as its schema reads it", async () => {
    for (const permission of ["appointments.edit", "visits.edit"]) {
      getSession.mockResolvedValue(member(["patients.view", permission]));
      expect(await post(typed)).toMatchObject({ status: 201, body: { data: NOTED } });
    }
    expect(recordFollowUpContact).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { kind: "VISIT", id: VISIT, outcome: "NO_ANSWER", note: "Line busy", snoozeUntil: "2026-10-18" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one without either, a view-only clinic, and what it cannot read", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view", "visits.view"]));
    expect((await post(typed)).status).toBe(403);
    const session = member(["patients.view", "visits.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post(typed)).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    getSession.mockResolvedValue(member(["patients.view", "visits.edit"]));
    expect((await post({ ...typed, outcome: "" })).status).toBe(400);
    expect((await post({ ...typed, snoozeUntil: "2026-02-30" })).status).toBe(400);
    expect(recordFollowUpContact).not.toHaveBeenCalled();
  });
});
