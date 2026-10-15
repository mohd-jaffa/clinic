import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listPatientTimeline } = vi.hoisted(() => ({ getSession: vi.fn(), listPatientTimeline: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/timeline", () => ({ listPatientTimeline }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/patients/[id]/timeline/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "p-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query = "") =>
  answerOf(await GET(apiRequest(`/api/patients/p-1/timeline${query}`, { headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  listPatientTimeline.mockResolvedValue({ items: [], nextCursor: null });
});

describe("GET /api/patients/[id]/timeline (plan §10.3, D225)", () => {
  it("reads a page of the patient's history from where it starts in each part, for patients.view", async () => {
    getSession.mockResolvedValue(member(["patients.view"]));
    expect(await get("?cursor=12.8")).toMatchObject({ status: 200, body: { data: { items: [] } } });
    expect(listPatientTimeline).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "p-1", {
      visits: 12,
      appointments: 8,
    });
    await get();
    expect(listPatientTimeline).toHaveBeenLastCalledWith(expect.anything(), "p-1", undefined);
  });

  it("refuses a page it cannot read, and someone who may not see patients", async () => {
    getSession.mockResolvedValue(member(["patients.view"]));
    expect((await get("?cursor=x")).status).toBe(400);
    expect((await get("?cursor=20")).status).toBe(400);
    getSession.mockResolvedValue(member([]));
    expect((await get()).status).toBe(403);
  });
});
