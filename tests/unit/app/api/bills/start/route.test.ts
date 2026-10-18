import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getBillStart } = vi.hoisted(() => ({ getSession: vi.fn(), getBillStart: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/api", () => ({ getBillStart }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/bills/start/route");

const VISIT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) =>
  answerOf(await GET(apiRequest(`/api/bills/start${query}`, { method: "GET", headers: auth })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
  getBillStart.mockResolvedValue({ patient: { id: "p-1" } });
});

describe("GET /api/bills/start (plan §15.2, D313)", () => {
  it("reads where a bill starts — a visit, an arrival or a patient — for payments.create", async () => {
    expect(await get(`?visit=${VISIT}`)).toMatchObject({ status: 200, body: { data: { patient: { id: "p-1" } } } });
    expect(getBillStart).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), { visit: VISIT });
  });

  it("refuses no target, two, or one that is not an id", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get(`?visit=${VISIT}&patient=${VISIT}`)).status).toBe(400);
    expect((await get("?appointment=seven")).status).toBe(400);
    expect(getBillStart).not.toHaveBeenCalled();
  });

  it("refuses someone who may not issue bills — a view-only clinic still reads", async () => {
    getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
    expect((await get(`?visit=${VISIT}`)).status).toBe(403);
    const session = member(["patients.view", "payments.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect((await get(`?visit=${VISIT}`)).status).toBe(200);
  });
});
