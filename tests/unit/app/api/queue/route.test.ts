import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listQueue } = vi.hoisted(() => ({ getSession: vi.fn(), listQueue: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ listQueue }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/queue/route");

const DOCTOR = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query = "") => answerOf(await GET(apiRequest(`/api/queue${query}`, { headers: auth })));

beforeEach(() => {
  vi.clearAllMocks();
  listQueue.mockResolvedValue([{ id: "a-1" }]);
});

describe("GET /api/queue (plan §11.4)", () => {
  it("reads one doctor's queue, or every doctor's, for appointments.view", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect(await get(`?doctorId=${DOCTOR}`)).toMatchObject({ status: 200, body: { data: [{ id: "a-1" }] } });
    expect(listQueue).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), { doctorId: DOCTOR });
    await get();
    expect(listQueue).toHaveBeenLastCalledWith(expect.anything(), {});
  });

  it("refuses a doctor it cannot read, and someone who may not see appointments", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await get("?doctorId=nope")).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view"]));
    expect((await get()).status).toBe(403);
  });
});
