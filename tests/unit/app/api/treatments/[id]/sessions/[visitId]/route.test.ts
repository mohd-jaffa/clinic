import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, recordSession, removeSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
  recordSession: vi.fn(),
  removeSession: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/treatments/records", () => ({ recordSession, removeSession }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { DELETE, PUT } = await import("@/app/api/treatments/[id]/sessions/[visitId]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "t-1", visitId: "v-1" }) };
const URL = "/api/treatments/t-1/sessions/v-1";
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const put = async (body: unknown) =>
  answerOf(await PUT(apiRequest(URL, { method: "PUT", headers: auth, body }), params));
const remove = async () => answerOf(await DELETE(apiRequest(URL, { method: "DELETE", headers: auth }), params));
const typed = { note: "Canal filled", complete: true, seen: { note: "Opened" } };

beforeEach(() => {
  vi.clearAllMocks();
  recordSession.mockResolvedValue({ note: "Canal filled", status: "COMPLETED" });
  removeSession.mockResolvedValue({ treatmentId: "t-1", visitId: "v-1" });
});

describe("PUT /api/treatments/[id]/sessions/[visitId] (D256, D257)", () => {
  it("saves this visit's session, completing it when asked, for visits.edit", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
    expect(await put(typed)).toMatchObject({ status: 200, body: { data: { status: "COMPLETED" } } });
    expect(recordSession).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "t-1",
      "v-1",
      typed,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one without visits.edit, and what it cannot read", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.create"]));
    expect((await put(typed)).status).toBe(403);
    getSession.mockResolvedValue(member(["visits.edit"]));
    expect((await put({ note: "x" })).status).toBe(400);
    expect(recordSession).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/treatments/[id]/sessions/[visitId] (D254)", () => {
  it("removes it for visits.edit, and for no one else", async () => {
    getSession.mockResolvedValue(member(["visits.edit"]));
    expect(await remove()).toMatchObject({ status: 200, body: { data: { treatmentId: "t-1", visitId: "v-1" } } });
    expect(removeSession).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "t-1",
      "v-1",
      expect.stringMatching(/^req_/),
    );
    getSession.mockResolvedValue(member(["visits.view"]));
    expect((await remove()).status).toBe(403);
    expect(removeSession).toHaveBeenCalledTimes(1);
  });
});
