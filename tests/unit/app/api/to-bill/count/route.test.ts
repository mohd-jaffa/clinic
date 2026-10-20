import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, countToBill } = vi.hoisted(() => ({ getSession: vi.fn(), countToBill: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/checkout", () => ({ countToBill }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/to-bill/count/route");

const DOCTOR = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) =>
  answerOf(
    await GET(apiRequest(`/api/to-bill/count${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
  countToBill.mockResolvedValue({ count: 3 });
});

describe("GET /api/to-bill/count (D337)", () => {
  it("counts one doctor's visits to bill, or every doctor's, for payments.view", async () => {
    expect(await get(`?doctorId=${DOCTOR}`)).toMatchObject({ status: 200, body: { data: { count: 3 } } });
    expect(countToBill).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), { doctorId: DOCTOR });
  });

  it("refuses someone who does not read bills", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await get("")).status).toBe(403);
    expect(countToBill).not.toHaveBeenCalled();
  });
});
